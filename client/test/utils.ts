import * as vscode from "vscode";

import { assert } from "chai";
import { readFileSync } from "fs";
import * as nodeAssert from "node:assert";
import * as path from "path";

export function getUri(name: string): vscode.Uri {
  return vscode.Uri.file(path.resolve(__dirname, "../../testFixture", name));
}

export async function openDoc(docUri: vscode.Uri): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(docUri);
  await vscode.window.showTextDocument(doc);
  await sleep(5000); // Wait for server activation
}

async function hasSasNotebookSupport(): Promise<boolean> {
  const commands = await vscode.commands.getCommands(true);
  return commands.includes("SAS.notebook.export");
}

export async function activateSasExtension(): Promise<void> {
  const extension =
    vscode.extensions.getExtension("SAS.sas-lsp") ??
    vscode.extensions.all.find(
      (candidate) =>
        candidate.packageJSON.publisher === "SAS" &&
        candidate.packageJSON.name === "sas-lsp",
    );

  nodeAssert.ok(extension, "SAS extension was not found");

  if (extension.isActive || (await hasSasNotebookSupport())) {
    return;
  }

  try {
    await extension.activate();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("already registered") &&
      (await hasSasNotebookSupport())
    ) {
      return;
    }
    throw error;
  }

  nodeAssert.ok(
    extension.isActive || (await hasSasNotebookSupport()),
    "SAS extension did not activate",
  );
}

export async function openNotebookDoc(docUri: vscode.Uri): Promise<void> {
  await activateSasExtension();
  const doc = await vscode.workspace.openNotebookDocument(docUri);
  await vscode.window.showNotebookDocument(doc);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getTestFixtureContent(name: string): Buffer {
  return readFileSync(path.resolve(__dirname, "../../testFixture", name));
}

export const assertThrowsAsync = async (
  fn: () => Promise<unknown>,
  expectedMsg?: string,
) => {
  try {
    await fn();
  } catch (err) {
    if (expectedMsg) {
      const typedError = err instanceof Error ? err : new Error(String(err));
      assert.include(
        typedError.message,
        expectedMsg,
        "Expected Message not found in returned error message",
      );
    }
    return;
  }
  assert.fail("function was expected to throw, but did not");
};
