import { WebviewPanel, l10n, window } from "vscode";

import { expect } from "chai";
import { readFileSync } from "fs";
import { join } from "path";
import * as sinon from "sinon";
import { runInNewContext } from "vm";

import { BrowserFileDownloadTarget } from "../../../src/components/LibraryNavigator/BrowserFileDownloadTarget/BrowserFileDownloadTarget";
import { createBrowserFileWriterScript } from "../../../src/components/LibraryNavigator/BrowserFileDownloadTarget/BrowserFileWriter";

interface MockPanel {
  visible: boolean;
  title: string;
  webview: {
    html: string;
    onDidReceiveMessage: (
      listener: (message: Record<string, unknown>) => void,
    ) => void;
    postMessage: (message: Record<string, unknown>) => Promise<boolean>;
  };
  onDidDispose: (listener: () => void) => void;
  onDidChangeViewState: (
    listener: (event: { webviewPanel: MockPanel }) => void,
  ) => void;
  reveal: () => void;
  dispose: () => void;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const isUint8Array = (value: unknown): value is Uint8Array =>
  value instanceof Uint8Array;

interface CommandContribution {
  command: string;
  title: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCommandContribution = (value: unknown): value is CommandContribution =>
  isRecord(value) &&
  typeof value.command === "string" &&
  typeof value.title === "string";

const isCommandManifest = (
  value: unknown,
): value is { contributes: { commands: CommandContribution[] } } =>
  isRecord(value) &&
  isRecord(value.contributes) &&
  Array.isArray(value.contributes.commands) &&
  value.contributes.commands.every(isCommandContribution);

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) &&
  Object.values(value).every((item) => typeof item === "string");

describe("BrowserFileDownloadTarget", () => {
  let sandbox: sinon.SinonSandbox;
  let target: BrowserFileDownloadTarget;
  let panel: MockPanel;
  let receiveMessage: (message: Record<string, unknown>) => void;
  let onDispose: () => void;
  let onViewState: (event: { webviewPanel: MockPanel }) => void;
  let writes: Record<string, unknown>[];
  let rejectWrite = false;
  let unsupported = false;
  let activeWrites = 0;
  let maximumActiveWrites = 0;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    writes = [];
    rejectWrite = false;
    unsupported = false;
    activeWrites = 0;
    maximumActiveWrites = 0;
    panel = {
      visible: true,
      title: "",
      webview: {
        html: "",
        onDidReceiveMessage: (listener) => {
          receiveMessage = listener;
          queueMicrotask(() => receiveMessage({ type: "ready" }));
        },
        postMessage: async (message) => {
          if (message.type === "choose") {
            queueMicrotask(() =>
              receiveMessage({
                type: "destination",
                choiceId: message.choiceId,
                kind: unsupported ? "unsupported" : "local",
                token: "browser-file-token",
                fileName: "work.table.csv",
                error: unsupported
                  ? "Local file selection is unsupported."
                  : undefined,
              }),
            );
          } else if (message.type === "write") {
            activeWrites++;
            maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
            writes.push(message);
            await new Promise((resolve) => setTimeout(resolve, 10));
            activeWrites--;
            receiveMessage({
              type: "ack",
              requestId: message.requestId,
              ok: !rejectWrite,
              error: rejectWrite ? "Browser write failed" : undefined,
            });
          } else if (message.type === "abort") {
            writes.push(message);
          } else if (message.requestId) {
            receiveMessage({
              type: "ack",
              requestId: message.requestId,
              ok: true,
            });
          }
          return true;
        },
      },
      onDidDispose: (listener) => {
        onDispose = listener;
      },
      onDidChangeViewState: (listener) => {
        onViewState = listener;
      },
      reveal: () => {},
      dispose: () => onDispose(),
    };
    sandbox
      .stub(window, "createWebviewPanel")
      // The test panel supplies only the webview lifecycle used by this bridge.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      .returns(panel as unknown as WebviewPanel);
    target = new BrowserFileDownloadTarget();
  });

  afterEach(() => {
    target.dispose();
    sandbox.restore();
  });

  async function chooseFile() {
    return target.chooseLocalFile("work.table.csv", "WORK.TABLE");
  }

  it("streams bounded chunks one-at-a-time and waits for browser acknowledgements", async () => {
    const choice = await chooseFile();
    expect(choice.kind).to.equal("local");
    if (choice.kind !== "local") {
      throw new Error("Expected a local file destination.");
    }
    const destination = choice;
    expect(destination?.token).to.equal("browser-file-token");
    await target.open(destination.token, "transfer", destination.fileName);

    const source = Uint8Array.from(
      { length: 500 * 1024 },
      (_value, index) => index % 256,
    );
    await target.write("transfer", source, new AbortController().signal);

    const messages = writes.filter((message) => message.type === "write");
    expect(messages).to.have.length(3);
    expect(maximumActiveWrites).to.equal(1);
    const chunks = messages.map((message) => {
      expect(isUint8Array(message.data)).to.equal(true);
      if (!isUint8Array(message.data)) {
        throw new Error("Browser download chunk was not a Uint8Array.");
      }
      const chunk = message.data;
      expect(message.byteLength).to.equal(chunk.byteLength);
      expect(chunk.byteLength).to.be.at.most(192 * 1024);
      expect(chunk.byteOffset).to.equal(0);
      expect(chunk.buffer.byteLength).to.equal(chunk.byteLength);
      return chunk;
    });
    expect(chunks.map((chunk) => chunk.byteLength)).to.deep.equal([
      192 * 1024,
      192 * 1024,
      116 * 1024,
    ]);
    expect(
      Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
    ).to.deep.equal(Buffer.from(source));
  });

  it("pauses writes while hidden and resumes when the panel is shown", async () => {
    await chooseFile();
    const destination = { token: "browser-file-token", fileName: "table.csv" };
    await target.open(destination.token, "transfer", destination.fileName);
    panel.visible = false;
    onViewState({ webviewPanel: panel });

    const write = target.write(
      "transfer",
      new Uint8Array([1, 2, 3]),
      new AbortController().signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(writes.filter((message) => message.type === "write")).to.have.length(
      0,
    );

    panel.visible = true;
    onViewState({ webviewPanel: panel });
    await write;
    expect(writes.filter((message) => message.type === "write")).to.have.length(
      1,
    );
  });

  it("aborts a hidden export when its panel closes", async () => {
    await chooseFile();
    const controller = new AbortController();
    const closed = target.onDidClose(() =>
      controller.abort(new Error("panel closed")),
    );
    panel.visible = false;
    onViewState({ webviewPanel: panel });
    const write = target.write(
      "transfer",
      new Uint8Array([1]),
      controller.signal,
    );

    panel.dispose();
    closed.dispose();

    let failure: unknown;
    try {
      await write;
    } catch (error) {
      failure = error;
    }
    expect(failure).to.be.instanceOf(Error);
    expect(errorMessage(failure)).to.equal("panel closed");
  });

  it("surfaces browser writer failures", async () => {
    await chooseFile();
    rejectWrite = true;
    let failure: unknown;
    try {
      await target.write(
        "transfer",
        new Uint8Array([1]),
        new AbortController().signal,
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).to.be.instanceOf(Error);
    expect(errorMessage(failure)).to.equal("Browser write failed");
  });

  it("rejects binary message delivery when the webview cannot post the chunk", async () => {
    await chooseFile();
    sandbox.stub(panel.webview, "postMessage").callsFake(async (message) => {
      if (message.type === "write") {
        return false;
      }
      if (message.requestId) {
        queueMicrotask(() =>
          receiveMessage({
            type: "ack",
            requestId: message.requestId,
            ok: true,
          }),
        );
      }
      return true;
    });

    let failure: unknown;
    try {
      await target.write(
        "transfer",
        new Uint8Array([1]),
        new AbortController().signal,
      );
    } catch (error) {
      failure = error;
    }
    expect(errorMessage(failure)).to.equal(
      "Could not deliver a browser download chunk.",
    );
  });

  it("validates binary chunks and writes them without Base64 decoding", async () => {
    await chooseFile();

    expect(panel.webview.html).to.include("message.data instanceof Uint8Array");
    expect(panel.webview.html).to.include(
      "message.data.buffer.byteLength !== message.data.byteLength",
    );
    expect(panel.webview.html).to.include(
      "await transfer.writer.write(message.data)",
    );
    expect(panel.webview.html).not.to.include("decodeBase64");
    expect(panel.webview.html).not.to.include("atob(");
  });

  it("aborts the browser writer when binary delivery is inconsistent", async () => {
    const elements = new Map<
      string,
      {
        addEventListener: (
          type: string,
          listener: () => Promise<void> | void,
        ) => void;
      }
    >();
    const elementListeners = new Map<string, () => Promise<void> | void>();
    const acknowledgements: Record<string, unknown>[] = [];
    let messageListener:
      ((event: { data: Record<string, unknown> }) => Promise<void>) | undefined;
    let writeCount = 0;
    let abortCount = 0;
    const writer = {
      write: async () => {
        writeCount++;
      },
      close: async () => {},
      abort: async () => {
        abortCount++;
      },
    };
    const fileHandle = {
      name: "table.csv",
      queryPermission: async () => "granted",
      createWritable: async () => writer,
    };
    const document = {
      getElementById: (id: string) => {
        if (!elements.has(id)) {
          elements.set(id, {
            addEventListener: (type, listener) => {
              elementListeners.set(`${id}:${type}`, listener);
            },
          });
        }
        return elements.get(id);
      },
    };
    const window = {
      addEventListener: (
        _type: string,
        listener: (event: { data: Record<string, unknown> }) => Promise<void>,
      ) => {
        messageListener = listener;
      },
      showSaveFilePicker: async () => fileHandle,
    };
    const script = createBrowserFileWriterScript("test-nonce", {
      unsupportedFilePicker: "Unsupported",
      preparingExport: "Preparing",
      selectionCanceled: "Canceled",
      selectionFailed: "Failed: {error}",
      chooseLocation: "Choose location",
      selectedFileUnavailable: "File unavailable",
      permissionRevoked: "Permission revoked",
      writerNotOpen: "Writer not open",
      abortFailed: "Abort failed: {error}",
    });
    const scriptBody = script.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
    if (!scriptBody) {
      throw new Error("Could not extract browser file writer script.");
    }
    runInNewContext(scriptBody, {
      acquireVsCodeApi: () => ({
        postMessage: (message: Record<string, unknown>) =>
          acknowledgements.push(message),
      }),
      crypto: { randomUUID: () => "browser-file-token" },
      document,
      window,
      Uint8Array,
    });

    await elementListeners.get("choose-file:click")?.();
    await messageListener?.({
      data: {
        type: "open",
        requestId: "open",
        transferId: "transfer",
        token: "browser-file-token",
      },
    });
    await messageListener?.({
      data: {
        type: "write",
        requestId: "write",
        transferId: "transfer",
        data: new ArrayBuffer(1),
        byteLength: 1,
      },
    });

    expect(writeCount).to.equal(0);
    expect(abortCount).to.equal(1);
    const failure = acknowledgements[acknowledgements.length - 1];
    expect(failure?.ok).to.equal(false);
    expect(failure?.error).to.include("Invalid binary browser download chunk.");
  });

  it("reports unsupported browser file-picker capabilities", async () => {
    unsupported = true;
    expect(await chooseFile()).to.deep.equal({ kind: "unsupported" });
  });

  it("reports an unsupported picker as soon as the webview opens", async () => {
    const elements = new Map<
      string,
      {
        addEventListener: (type: string, listener: () => unknown) => void;
        hidden?: boolean;
        disabled?: boolean;
        textContent?: string;
      }
    >();
    const postedMessages: Record<string, unknown>[] = [];
    let messageListener:
      ((event: { data: Record<string, unknown> }) => Promise<void>) | undefined;
    const document = {
      getElementById: (id: string) => {
        if (!elements.has(id)) {
          elements.set(id, { addEventListener: () => undefined });
        }
        return elements.get(id);
      },
    };
    const window = {
      addEventListener: (
        _type: string,
        listener: (event: { data: Record<string, unknown> }) => Promise<void>,
      ) => {
        messageListener = listener;
      },
    };
    const script = createBrowserFileWriterScript("test-nonce", {
      unsupportedFilePicker: "Unsupported",
      preparingExport: "Preparing",
      selectionCanceled: "Canceled",
      selectionFailed: "Failed: {error}",
      chooseLocation: "Choose location",
      selectedFileUnavailable: "File unavailable",
      permissionRevoked: "Permission revoked",
      writerNotOpen: "Writer not open",
      abortFailed: "Abort failed: {error}",
    });
    const scriptBody = script.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
    if (!scriptBody) {
      throw new Error("Could not extract browser file writer script.");
    }
    runInNewContext(scriptBody, {
      acquireVsCodeApi: () => ({
        postMessage: (message: Record<string, unknown>) =>
          postedMessages.push(message),
      }),
      document,
      window,
    });

    await messageListener?.({
      data: {
        type: "choose",
        choiceId: "choice",
        fileName: "table.csv",
      },
    });

    expect(
      postedMessages.filter((message) => message.type === "destination"),
    ).to.deep.equal([
      {
        type: "destination",
        choiceId: "choice",
        kind: "unsupported",
        error: "Unsupported",
      },
    ]);
  });

  it("renders an accessible panel with nonce-restricted scripts and styles", async () => {
    await chooseFile();
    const nonce = panel.webview.html.match(/script-src 'nonce-([^']+)'/)?.[1];

    expect(nonce).to.be.a("string").and.not.empty;
    expect(panel.webview.html).to.include(`<script nonce="${nonce}">`);
    expect(panel.webview.html).to.include(`<style nonce="${nonce}">`);
    expect(panel.webview.html).to.include('role="status" aria-live="polite"');
  });

  it("localizes the browser picker UI and client-side messages", async () => {
    sandbox.stub(l10n, "t").callsFake((message) => `localized:${message}`);

    await chooseFile();

    expect(panel.title).to.equal("localized:Download Table: {tableName}");
    expect(panel.webview.html).to.include(
      "<title>localized:Download SAS Table to This Computer</title>",
    );
    expect(panel.webview.html).to.include(
      "<h1>localized:Save to Local Machine</h1>",
    );
    expect(panel.webview.html).to.include("localized:Choose a destination.");
    expect(panel.webview.html).to.include(
      "localized:This browser does not support choosing a local file from this webview.",
    );
    expect(panel.webview.html).to.include(
      "localized:Permission for the selected file was revoked; select the destination again.",
    );
    const serializedMessages = panel.webview.html.match(
      /const messages = (.+);/,
    )?.[1];
    expect(serializedMessages).to.be.a("string");
    if (!serializedMessages) {
      throw new Error("The browser writer messages were not serialized.");
    }
    const parsedMessages: unknown = JSON.parse(serializedMessages);
    if (!isStringRecord(parsedMessages)) {
      throw new Error("The browser writer messages were invalid.");
    }
    expect(parsedMessages.unsupportedFilePicker).to.equal(
      "localized:This browser does not support choosing a local file from this webview.",
    );
    expect(parsedMessages.selectionFailed).to.equal(
      "localized:Local file selection failed: {error}",
    );
    expect(parsedMessages.abortFailed).to.equal(
      "localized:Abort also failed: {error}",
    );
  });

  it("escapes localized HTML and safely serializes writer messages", async () => {
    sandbox.stub(l10n, "t").callsFake((message) => {
      const source = String(message);
      if (source === "Save to Local Machine") {
        return '<b>& "Save to Local Machine"</b>';
      }
      if (
        source ===
        "This browser does not support choosing a local file from this webview."
      ) {
        return "</script><script>&";
      }
      return source;
    });

    await chooseFile();

    expect(panel.webview.html).to.include(
      "<h1>&lt;b&gt;&amp; &quot;Save to Local Machine&quot;&lt;/b&gt;</h1>",
    );
    expect(panel.webview.html).not.to.include("</script><script>&");
    const serializedMessages = panel.webview.html.match(
      /const messages = (.+);/,
    )?.[1];
    expect(serializedMessages).to.be.a("string");
    if (!serializedMessages) {
      throw new Error("The browser writer messages were not serialized.");
    }
    const parsedMessages: unknown = JSON.parse(serializedMessages);
    if (!isStringRecord(parsedMessages)) {
      throw new Error("The browser writer messages were invalid.");
    }
    expect(parsedMessages.unsupportedFilePicker).to.equal("</script><script>&");
  });

  it("uses package localization keys for the destination command titles", () => {
    const parsedManifest: unknown = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    );
    const parsedPackageNls: unknown = JSON.parse(
      readFileSync(join(process.cwd(), "package.nls.json"), "utf8"),
    );
    if (!isCommandManifest(parsedManifest)) {
      throw new Error(
        "The package manifest has invalid command contributions.",
      );
    }
    if (!isStringRecord(parsedPackageNls)) {
      throw new Error("The package localization file has invalid entries.");
    }
    const commandKeys = [
      [
        "SAS.downloadTableRemoteWorkspace",
        "commands.SAS.downloadTableRemoteWorkspace",
      ],
      ["SAS.downloadTableToComputer", "commands.SAS.downloadTableToComputer"],
    ];

    for (const [command, key] of commandKeys) {
      const contribution = parsedManifest.contributes.commands.find(
        (item) => item.command === command,
      );
      expect(contribution?.title).to.equal(`%${key}%`);
      expect(parsedPackageNls[key]).to.be.a("string").and.not.empty;
    }
  });

  it("aborts an in-flight browser write when canceled", async () => {
    await chooseFile();
    const controller = new AbortController();
    const write = target.write(
      "transfer",
      new Uint8Array([1]),
      controller.signal,
    );
    setTimeout(() => controller.abort(new Error("canceled")), 1);

    let failure: unknown;
    try {
      await write;
    } catch (error) {
      failure = error;
    }
    expect(errorMessage(failure)).to.equal("canceled");
    expect(writes.some((message) => message.type === "abort")).to.equal(true);
  });
});
