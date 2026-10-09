import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";

import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";
import { LibCompleteItem } from "../../src/sas/SyntaxDataProvider";

const libraries: LibCompleteItem[] = [
  { id: "SASHELP", name: "SASHELP", type: "LIBRARY" },
  { id: "WORK", name: "WORK", type: "LIBRARY" },
];

const tables: LibCompleteItem[] = [
  { id: "CLASS", name: "CLASS", type: "DATA" },
  { id: "CARS", name: "CARS", type: "DATA" },
];

async function complete(
  code: string,
  lookup: (libId: string | null) => LibCompleteItem[],
) {
  const doc = TextDocument.create("file:///library-test.sas", "sas", 1, code);
  const service = new LanguageServiceProvider(doc);
  const requests: Array<string | null> = [];

  service.setLibService((libId, resolve) => {
    requests.push(libId);
    resolve(lookup(libId));
  });

  const position = doc.positionAt(code.length);
  const result = await service.completionProvider.getCompleteItems({
    textDocument: { uri: doc.uri },
    position,
  });

  return {
    labels: result?.items.map((item) => String(item.label).toUpperCase()) ?? [],
    requests,
  };
}

describe("connected library completions", () => {
  it("suggests libraries after DATA=", async () => {
    const result = await complete("proc print data=", (libId) =>
      libId === null ? libraries : [],
    );

    assert.includeMembers(result.labels, ["SASHELP", "WORK"]);
    assert.deepEqual(result.requests, [null]);
  });

  it("suggests tables after a library and dot", async () => {
    const result = await complete("proc print data=SASHELP.", (libId) =>
      libId === null ? libraries : libId === "SASHELP" ? tables : [],
    );

    assert.includeMembers(result.labels, ["CLASS", "CARS"]);
    assert.deepEqual(result.requests, [null, "SASHELP"]);
  });

  it("fetches libraries only once for a dataset typed statement option", async () => {
    const result = await complete("proc logistic;\noutput out=", (libId) =>
      libId === null ? libraries : [],
    );

    assert.include(result.labels, "SASHELP");
    assert.deepEqual(result.requests, [null]);
  });
});
