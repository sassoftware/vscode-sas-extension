// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n, window } from "vscode";

import { readFileSync } from "fs";
import { NextAuthHandler, ParsedKey, Prompt, utils } from "ssh2";

/**
 * Abstraction for presenting authentication prompts to the user.
 */
export interface AuthPresenter {
  /**
   * Prompt the user for a passphrase.
   * @returns the passphrase entered by the user
   */
  presentPasswordPrompt: () => Promise<string>;
  /**
   * Prompt the user for a password.
   * @returns the password entered by the user
   */
  presentPassphrasePrompt: () => Promise<string>;
  /**
   * Present multiple prompts to the user.
   * This scenario can happen when the server sends multiple input prompts to the user during keyboard-interactive authentication.
   * Auth setups involving MFA or PAM can trigger this scenario.
   * One input box will be presented for each prompt.
   * @param prompts an array of prompts to present to the user
   * @returns array of answers to the prompts
   */
  presentMultiplePrompts: (prompts: Prompt[]) => Promise<string[]>;
}

class AuthPresenterImpl implements AuthPresenter {
  presentPasswordPrompt = async (): Promise<string> => {
    return this.presentSecurePrompt(
      l10n.t("Enter your password for this connection"),
      l10n.t("Password Required"),
    );
  };

  presentPassphrasePrompt = async (): Promise<string> => {
    return this.presentSecurePrompt(
      l10n.t("Enter the passphrase for the private key"),
    );
  };

  presentMultiplePrompts = async (prompts: Prompt[]): Promise<string[]> => {
    const answers: string[] = [];
    for (const prompt of prompts) {
      this.presentSecurePrompt(prompt.prompt).then((answer) => {
        answers.push(answer);
      });
    }
    return answers;
  };

  /**
   * Present a secure prompt to the user.
   * @param prompt  the prompt to display to the user
   * @param title  optional title for the prompt
   * @returns the user's response to the prompt
   */
  private presentSecurePrompt = async (
    prompt: string,
    title?: string,
  ): Promise<string> => {
    return window.showInputBox({
      ignoreFocusOut: true,
      prompt: prompt,
      title: title,
      password: true,
    });
  };
}

/**
 * Handles the authentication process for the ssh connection.
 *
 */
export class AuthHandler {
  private _authPresenter: AuthPresenter;
  private _keyParser: KeyParser;

  constructor(authPresenter?: AuthPresenter, keyParser?: KeyParser) {
    this._authPresenter = authPresenter;
    this._keyParser = keyParser;

    if (!authPresenter) {
      this._authPresenter = new AuthPresenterImpl();
    }
    if (!keyParser) {
      this._keyParser = new KeyParserImpl();
    }
  }

  /**
   * Authenticate to the server using the password method.
   * @param cb ssh2 NextHandler callback instance. This is used to pass the authentication information to the ssh server.
   * @param resolve a function that resolves the promise that is waiting for the password
   * @param username the user name to use for the connection
   */
  passwordAuth = (cb: NextAuthHandler, username: string) => {
    this._authPresenter.presentPasswordPrompt().then((pw) => {
      cb({
        type: "password",
        password: pw,
        username: username,
      });
    });
  };

  /**
   * Authenticate to the server using the keyboard-interactive method.
   * @param cb ssh2 NextHandler callback instance. This is used to pass the authentication information to the ssh server.
   * @param resolve a function that resolves the promise that is waiting for authentication
   * @param username the user name to use for the connection
   */
  keyboardInteractiveAuth = (cb: NextAuthHandler, username: string) => {
    cb({
      type: "keyboard-interactive",
      username: username,
      prompt: (_name, _instructions, _instructionsLang, prompts, promptCb) => {
        // often, the server will only send a single prompt for the password.
        // however, PAM can send multiple prompts, so we need to handle that case
        this._authPresenter
          .presentMultiplePrompts(prompts)
          .then((answers) => promptCb(answers));
      },
    });
  };

  /**
   * Authenticate to the server using the ssh-agent. See the extension README for more information on how to set up the ssh-agent.
   * @param cb ssh2 NextHandler callback instance. This is used to pass the authentication information to the ssh server.
   * @param username the user name to use for the connection
   */
  sshAgentAuth = (cb: NextAuthHandler, username: string) => {
    cb({
      type: "agent",
      agent: process.env.SSH_AUTH_SOCK,
      username: username,
    });
  };

  /**
   * Authenticate to the server using a private key file.
   * If a private key file is defined in the connection profile, this function will read the file and use it to authenticate to the server.
   * If the key is encrypted, the user will be prompted for the passphrase.
   * @param cb ssh2 NextHandler callback instance. This is used to pass the authentication information to the ssh server.
   * @param resolve a function that resolves the promise that is waiting for authentication
   * @param privateKeyFilePath the path to the private key file defined in the connection profile
   * @param username the user name to use for the connection
   */
  privateKeyAuth = (
    cb: NextAuthHandler,
    privateKeyFilePath: string,
    username: string,
  ) => {
    // first, try to parse the key file without a passphrase
    const parsedKeyResult = this._keyParser.parseKey(privateKeyFilePath);
    const hasParseError = parsedKeyResult instanceof Error;
    const passphraseRequired =
      hasParseError &&
      parsedKeyResult.message ===
        "Encrypted OpenSSH private key detected, but no passphrase given";
    // key is encrypted, prompt for passphrase
    if (passphraseRequired) {
      this._authPresenter.presentPassphrasePrompt().then((passphrase) => {
        //parse the keyfile using the passphrase
        const passphrasedKeyContentsResult = this._keyParser.parseKey(
          privateKeyFilePath,
          passphrase,
        );

        if (passphrasedKeyContentsResult instanceof Error) {
          throw passphrasedKeyContentsResult;
        }
        cb({
          type: "publickey",
          key: passphrasedKeyContentsResult,
          passphrase: passphrase,
          username: username,
        });
      });
    } else {
      if (hasParseError) {
        throw parsedKeyResult;
      }
      cb({
        type: "publickey",
        key: parsedKeyResult,
        username: username,
      });
    }
  };
}

/**
 * Parses a private key file.
 */
export interface KeyParser {
  /**
   * Parse the private key file.
   * If a passphrase is specified, the key will be decrypted using the passphrase.
   * @param privateKeyPath the path to the private key file
   * @param passphrase the passphrase to decrypt the key if applicable
   * @returns the parsed key or an error if the key could not be parsed
   */
  parseKey: (privateKeyPath: string, passphrase?: string) => ParsedKey | Error;
}

class KeyParserImpl implements KeyParser {
  private readKeyFile = (privateKeyPath: string): Buffer => {
    try {
      return readFileSync(privateKeyPath);
    } catch (e) {
      throw new Error(
        l10n.t("Error reading private key file: {filePath}, error: {message}", {
          filePath: privateKeyPath,
          message: e.message,
        }),
      );
    }
  };

  public parseKey = (
    privateKeyPath: string,
    passphrase?: string,
  ): ParsedKey | Error => {
    const keyContents = this.readKeyFile(privateKeyPath);
    return utils.parseKey(keyContents, passphrase);
  };
}
