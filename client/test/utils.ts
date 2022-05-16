import * as vscode from "vscode";
import * as path from "path";

export function getUri(name: string): vscode.Uri {
  return vscode.Uri.file(path.resolve(__dirname, "../../testFixture", name));
}

export async function openDoc(docUri: vscode.Uri): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(docUri);
  await vscode.window.showTextDocument(doc);
  await sleep(2000); // Wait for server activation
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
