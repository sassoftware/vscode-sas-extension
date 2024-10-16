import { expect } from "chai";
import * as fs from "fs";
import { KeyboardInteractiveAuthMethod, ParsedKey } from "ssh2";
import sinon, { stubInterface } from "ts-sinon";

import {
  AuthHandler,
  AuthPresenter,
  KeyParser,
} from "../../../src/connection/ssh/auth";

describe("ssh connection auth handler", () => {
  let authHandler: AuthHandler;

  describe("sshAgentAuth", () => {
    beforeEach(() => {
      process.env.SSH_AUTH_SOCK = "socketPath";
    });

    it("pass socket path to the callback", async () => {
      const username = "username";
      const socketPath = "socketPath";

      const presenter = stubInterface<AuthPresenter>();
      authHandler = new AuthHandler(presenter);

      const agentPayload = authHandler.sshAgentAuth(username);

      expect(agentPayload).to.deep.equal({
        type: "agent",
        agent: socketPath,
        username: username,
      });
    });
  });

  describe("privateKeyAuth", () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });
    afterEach(() => {
      sandbox.restore();
    });

    it("should pass the key contents and passphrase to the callback for an encrypted key", async () => {
      const username = "username";
      const passphrase = "passphrase";
      const privateKeyFilePath = "privateKeyFilePath";

      const presenter = stubInterface<AuthPresenter>();
      const keyParser = stubInterface<KeyParser>();

      const key = stubInterface<ParsedKey>();
      keyParser.parseKey
        .withArgs(privateKeyFilePath)
        .returns(
          new Error(
            "Encrypted private OpenSSH key detected, but no passphrase given",
          ),
        );
      keyParser.parseKey.withArgs(privateKeyFilePath, passphrase).returns(key);
      presenter.presentPassphrasePrompt.resolves(passphrase);

      authHandler = new AuthHandler(presenter, keyParser);

      const pkPayload = await authHandler.privateKeyAuth(
        privateKeyFilePath,
        username,
      );

      expect(pkPayload).to.deep.equal({
        type: "publickey",
        key: key,
        passphrase: passphrase,
        username: username,
      });
    });

    it("should pass the key contents to the callback for an unencrypted key", async () => {
      const username = "username";
      const privateKeyFilePath = "privateKeyFilePath";

      sandbox
        .stub(fs, "readFileSync")
        .callsFake(() => Buffer.from("keyContents"));

      const presenter = stubInterface<AuthPresenter>();
      const keyParser = stubInterface<KeyParser>();

      const key = stubInterface<ParsedKey>();
      keyParser.parseKey.returns(key);
      authHandler = new AuthHandler(presenter, keyParser);

      const pkPayload = await authHandler.privateKeyAuth(
        privateKeyFilePath,
        username,
      );
      expect(pkPayload).to.deep.equal({
        type: "publickey",
        key: key,
        username: username,
      });
    });
  });

  describe("passwordAuth", () => {
    it("should pass the password to the callback", async () => {
      const username = "username";
      const pw = "password";

      const presenter = stubInterface<AuthPresenter>();
      presenter.presentPasswordPrompt.resolves(pw);

      authHandler = new AuthHandler(presenter);

      const pwPayload = await authHandler.passwordAuth(username);

      expect(pwPayload).to.deep.equal({
        type: "password",
        password: pw,
        username: username,
      });
    });
  });

  describe("keyboardAuth", () => {
    it("should present input prompts and pass the answers to the callback", async () => {
      const promptCbStub = (answers: string[]) => {
        expect(answers).to.deep.equal(["answer1", "answer2"]);
      };
      const cb = (auth: KeyboardInteractiveAuthMethod) => {
        expect(auth.type).to.equal("keyboard-interactive");
        expect(auth.username).to.equal("username");
        auth.prompt(
          "name",
          "instruction",
          "lang",
          [{ prompt: "question1" }, { prompt: "question2" }],
          promptCbStub,
        );
      };

      const answers = ["answer1", "answer2"];
      const presenter = stubInterface<AuthPresenter>();
      presenter.presentMultiplePrompts.resolves(answers);

      authHandler = new AuthHandler(presenter);

      const kbPayload = await authHandler.keyboardInteractiveAuth("username");
      cb(kbPayload);
    });
  });
});
