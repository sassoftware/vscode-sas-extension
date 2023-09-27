import * as vscode from "vscode";

import { assert } from "chai";
import { readFileSync } from "fs";
import * as path from "path";

export function getUri(name: string): vscode.Uri {
  return vscode.Uri.file(path.resolve(__dirname, "../../testFixture", name));
}

export async function openDoc(docUri: vscode.Uri): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(docUri);
  await vscode.window.showTextDocument(doc);
  await sleep(5000); // Wait for server activation
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getTestFixtureContent(name: string): Buffer {
  return readFileSync(path.resolve(__dirname, "../../testFixture", name));
}

export const assertThrowsAsync = async (fn, expectedMsg?: string) => {
  try {
    await fn();
  } catch (err) {
    if (expectedMsg) {
      const typedError: Error = err;
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
