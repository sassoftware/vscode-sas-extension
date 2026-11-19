import * as vscode from "vscode";

import * as assert from "assert";

import { NotebookSerializer } from "../../../src/components/notebook/Serializer";

const testCell = new vscode.NotebookCellData(
  vscode.NotebookCellKind.Code,
  "test",
  "sas",
);
testCell.outputs = [
  new vscode.NotebookCellOutput([
    vscode.NotebookCellOutputItem.text("test", "application/test"),
    vscode.NotebookCellOutputItem.text("test1", "application/test1"),
  ]),
];
const testData = new vscode.NotebookData([
  new vscode.NotebookCellData(
    vscode.NotebookCellKind.Markup,
    "test",
    "markdown",
  ),
  testCell,
]);
const decoder = new TextDecoder();

describe("notebook serializer", () => {
  it("serialize/deserialize the data correctly", async () => {
    const serializer = new NotebookSerializer();
    const serializedData = await serializer.serializeNotebook(testData);
    const newData = await serializer.serializeNotebook(
      await serializer.deserializeNotebook(serializedData),
    );
    assert.equal(
      decoder.decode(newData),
      decoder.decode(serializedData),
      "The data don't match after serialize/deserialize",
    );
  });

  it("round-trips SAS execution logs without creating visible outputs", async () => {
    const serializer = new NotebookSerializer();
    const cell = new vscode.NotebookCellData(
      vscode.NotebookCellKind.Code,
      "proc sql; quit;",
      "sql",
    );
    const logs = [
      { type: "note", line: "NOTE: step started" },
      { type: "error", line: "ERROR 79-322" },
    ];
    cell.metadata = { sasExecutionLog: logs };

    const serialized = await serializer.serializeNotebook(
      new vscode.NotebookData([cell]),
    );
    const restored = await serializer.deserializeNotebook(serialized);

    assert.deepEqual(restored.cells[0].metadata.sasExecutionLog, logs);
    assert.equal(restored.cells[0].outputs?.length ?? 0, 0);
  });

  it("retains SAS log metadata through a real notebook edit", async function () {
    if (!vscode.workspace?.openNotebookDocument) {
      this.skip();
    }
    const cell = new vscode.NotebookCellData(
      vscode.NotebookCellKind.Code,
      "proc sql; quit;",
      "sql",
    );
    cell.metadata = { existing: "kept" };
    const notebook = await vscode.workspace.openNotebookDocument(
      "sas-notebook",
      new vscode.NotebookData([cell]),
    );
    const logs = [{ type: "error", line: "ERROR 79-322" }];
    const edit = new vscode.WorkspaceEdit();
    edit.set(notebook.uri, [
      vscode.NotebookEdit.updateCellMetadata(0, {
        ...notebook.cellAt(0).metadata,
        sasExecutionLog: logs,
      }),
    ]);

    assert.equal(await vscode.workspace.applyEdit(edit), true);
    assert.deepEqual(notebook.cellAt(0).metadata, {
      existing: "kept",
      sasExecutionLog: logs,
    });
    assert.equal(notebook.cellAt(0).outputs.length, 0);
  });

  it("keeps existing notebooks readable without SAS log metadata", async () => {
    const serializer = new NotebookSerializer();
    const oldData = new TextEncoder().encode(
      JSON.stringify([{ language: "sas", value: "run;", kind: 2 }]),
    );

    const restored = await serializer.deserializeNotebook(oldData);

    assert.equal(restored.cells[0].value, "run;");
    assert.equal(restored.cells[0].metadata?.sasExecutionLog, undefined);
  });

  it("does not add SAS metadata to serialized Python cells", async () => {
    const serializer = new NotebookSerializer();
    const cell = new vscode.NotebookCellData(
      vscode.NotebookCellKind.Code,
      "print('hello')",
      "python",
    );
    cell.metadata = {
      sasExecutionLog: [{ type: "normal", line: "old SAS log" }],
    };

    const serialized = await serializer.serializeNotebook(
      new vscode.NotebookData([cell]),
    );

    assert.equal(
      JSON.parse(decoder.decode(serialized))[0].sasExecutionLog,
      undefined,
    );
  });
});
