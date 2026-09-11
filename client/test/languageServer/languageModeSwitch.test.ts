// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as vscode from "vscode";

import * as assert from "assert";

import { getUri } from "../utils";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Language mode switch", () => {
  let sasDoc: vscode.TextDocument;
  const sasDocUri = getUri("SampleCode.sas");

  before(async () => {
    sasDoc = await vscode.workspace.openTextDocument(sasDocUri);
    await vscode.window.showTextDocument(sasDoc);
    await sleep(5000);
  });

  after(async () => {
    // Restore so other test suites see a SAS-mode document
    if (sasDoc.languageId !== "sas") {
      sasDoc = await vscode.languages.setTextDocumentLanguage(sasDoc, "sas");
      await sleep(1000);
    }
  });

  it("provides SAS hover before switching language", async () => {
    const hovers: vscode.Hover[] = await vscode.commands.executeCommand(
      "vscode.executeHoverProvider",
      sasDocUri,
      new vscode.Position(0, 0),
    );
    assert.ok(hovers?.length > 0, "SAS hover should be active before switch");
  });

  it("switches to Python without crashing the SAS server", async () => {
    sasDoc = await vscode.languages.setTextDocumentLanguage(sasDoc, "python");
    // Give the language server time to process the language switch.
    // Switching from SAS to Python triggers a didClose event for the SAS document.
    await sleep(2000);

    // Previously, switching a SAS file to another language could lead to
    // requests being sent for a document the server was no longer tracking.
    // This hover request helps verify that the server does not crash after
    // the language change.
    await vscode.commands.executeCommand(
      "vscode.executeHoverProvider",
      sasDocUri,
      new vscode.Position(0, 0),
    );
  });

  it("still serves SAS features for other documents after the switch", async () => {
    // Open a second SAS document. If the server crashed, it cannot respond.
    const otherUri = getUri("SampleCode2.sas");
    const otherDoc = await vscode.workspace.openTextDocument(otherUri);
    await vscode.window.showTextDocument(otherDoc);
    await sleep(2000);

    const hovers: vscode.Hover[] = await vscode.commands.executeCommand(
      "vscode.executeHoverProvider",
      otherUri,
      new vscode.Position(0, 0),
    );
    assert.ok(
      hovers?.length > 0,
      "SAS server must still respond for other SAS documents after a language switch",
    );
  });

  it("resumes SAS features when switched back to SAS", async () => {
    await vscode.window.showTextDocument(sasDoc);
    sasDoc = await vscode.languages.setTextDocumentLanguage(sasDoc, "sas");
    await sleep(2000);

    const hovers: vscode.Hover[] = await vscode.commands.executeCommand(
      "vscode.executeHoverProvider",
      sasDocUri,
      new vscode.Position(0, 0),
    );
    assert.ok(
      hovers?.length > 0,
      "SAS hover should resume after switching back to SAS",
    );
  });
});
