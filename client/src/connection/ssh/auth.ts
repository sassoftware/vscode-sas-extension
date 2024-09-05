import { CancellationTokenSource, l10n, window } from "vscode";

import { readFileSync } from "fs";
import { NextAuthHandler, utils } from "ssh2";

let _cancellationSource: CancellationTokenSource | undefined;

/**
 * Authenticate to the server using the password method.
 * @param cb ssh2 NextHandler callback instance. This is used to pass the authentication information to the ssh server.
 * @param resolve a function that resolves the promise that is waiting for the password
 * @param username the user name to use for the connection
 */
export const passwordAuth = (
  cb: NextAuthHandler,
  resolve: ((value?) => void) | undefined,
  username: string,
) => {
  promptForPassword(resolve).then((pw) => {
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
export const keyboardInteractiveAuth = (
  cb: NextAuthHandler,
  resolve: ((value?) => void) | undefined,
  username: string,
) => {
  cb({
    type: "keyboard-interactive",
    username: username,
    prompt: (_name, _instructions, _instructionsLang, prompts, cb) => {
      if (prompts.length === 1 && prompts[0].prompt === "Password:") {
        promptForPassword(resolve).then((pw) => {
          cb([pw]);
        });
      } else {
        cb([]);
      }
    },
  });
};

/**
 * Authenticate to the server using the ssh-agent. See the extension README for more information on how to set up the ssh-agent.
 * @param cb ssh2 NextHandler callback instance. This is used to pass the authentication information to the ssh server.
 * @param username the user name to use for the connection
 */
export const sshAgentAuth = (cb: NextAuthHandler, username: string) => {
  //attempt to auth using ssh-agent
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
export const privateKeyAuth = (
  cb: NextAuthHandler,
  resolve: ((value?) => void) | undefined,
  privateKeyFilePath: string,
  username: string,
) => {
  let keyContents: Buffer;
  try {
    keyContents = readFileSync(privateKeyFilePath);
  } catch (e) {
    l10n.t("Error reading private key file: {filePath}, error: {message}", {
      filePath: privateKeyFilePath,
      message: e.message,
    });
  }
  //check for passphrase, prompt if necessary
  //and then attempt to auth
  const parsedKeyResult = utils.parseKey(keyContents);
  const hasParseError = parsedKeyResult instanceof Error;
  const passphraseRequired =
    hasParseError &&
    parsedKeyResult.message ===
      "Encrypted OpenSSH private key detected, but no passphrase given";
  // key is encrypted, prompt for passphrase
  if (passphraseRequired) {
    promptForPassphrase(resolve).then((passphrase) => {
      //parse the keyfile using the passphrase
      const reparsedKeyContentsResult = utils.parseKey(keyContents, passphrase);

      if (!(reparsedKeyContentsResult instanceof Error)) {
        cb({
          type: "publickey",
          key: reparsedKeyContentsResult,
          passphrase: passphrase,
          username: username,
        });
      }
    });
  } else {
    if (!hasParseError) {
      cb({
        type: "publickey",
        key: parsedKeyResult,
        username: username,
      });
    }
  }
};

/**
 * Prompt the user for a passphrase.
 * @param resolve a function that resolves the promise that is waiting for authentication
 * @returns the passphrase entered by the user
 */
const promptForPassphrase = async (resolve): Promise<string> => {
  const passphrase = await window.showInputBox({
    prompt: l10n.t("Enter the passphrase for the private key."),
    password: true,
  });

  // user cancelled password dialog
  if (!passphrase) {
    resolve?.({});
  }

  return passphrase;
};

/**
 * Prompt the user for a password.
 * @param resolve a function that resolves the promise that is waiting for authentication
 * @returns the password entered by the user
 */
const promptForPassword = async (
  resolve: ((value?) => void) | undefined,
): Promise<string> => {
  const source = new CancellationTokenSource();
  _cancellationSource = source;
  const pw = await window.showInputBox(
    {
      ignoreFocusOut: true,
      password: true,
      prompt: l10n.t("Enter your password for this connection."),
      title: l10n.t("Password Required"),
    },
    _cancellationSource.token,
  );

  // user cancelled password dialog
  if (!pw) {
    resolve?.({});
  }

  return pw;
};
