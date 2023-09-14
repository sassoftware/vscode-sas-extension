// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextDecoder, TextEncoder } from "util";
import * as vscode from "vscode";

interface RawNotebookCell {
  language: string;
  value: string;
  kind: vscode.NotebookCellKind;
  outputs?: {
    items: {
      data: string;
      mime: string;
    }[];
  }[];
}

export class NotebookSerializer implements vscode.NotebookSerializer {
  private readonly _decoder = new TextDecoder();
  private readonly _encoder = new TextEncoder();

  async deserializeNotebook(content: Uint8Array): Promise<vscode.NotebookData> {
    const contents = this._decoder.decode(content);

    let raw: RawNotebookCell[];
    try {
      raw = JSON.parse(contents);
    } catch {
      raw = [];
    }

    const cells = raw.map((item) => {
      const cell = new vscode.NotebookCellData(
        item.kind,
        item.value,
        item.language,
      );
      if (item.outputs) {
        cell.outputs = item.outputs.map(
          (output) =>
            new vscode.NotebookCellOutput(
              output.items.map((item) =>
                vscode.NotebookCellOutputItem.text(item.data, item.mime),
              ),
            ),
        );
      }
      return cell;
    });

    return new vscode.NotebookData(cells);
  }

  async serializeNotebook(data: vscode.NotebookData): Promise<Uint8Array> {
    const contents: RawNotebookCell[] = [];

    for (const cell of data.cells) {
      const content: RawNotebookCell = {
        kind: cell.kind,
        language: cell.languageId,
        value: cell.value,
      };
      if (cell.outputs) {
        content.outputs = cell.outputs.map((output) => ({
          items: output.items.map((item) => ({
            data: this._decoder.decode(item.data),
            mime: item.mime,
          })),
        }));
      }
      contents.push(content);
    }

    return this._encoder.encode(JSON.stringify(contents));
  }
}
