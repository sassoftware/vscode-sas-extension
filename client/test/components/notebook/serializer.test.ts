import { NotebookSerializer } from "../../../src/components/notebook/Serializer";
import * as vscode from "vscode";
import * as assert from "assert";

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
});
