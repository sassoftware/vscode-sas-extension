import {
  StreamMessageReader,
  StreamMessageWriter,
  createProtocolConnection,
} from "vscode-languageserver-protocol/node";
import { createConnection } from "vscode-languageserver/node";

import assert from "assert";
import sinon from "sinon";
import { PassThrough } from "stream";

import { PyrightLanguageProviderBrowser } from "../../src/python/browser/PyrightLanguageProviderBrowser";
import {
  PyrightParseNodeType,
  analyzePythonFinalExpression,
} from "../../src/python/finalExpression";
import { PyrightLanguageProviderNode } from "../../src/python/node/PyrightLanguageProviderNode";
import { runServer } from "../../src/server";

const analyzers = [
  {
    name: "Node",
    analyze: (code: string) =>
      PyrightLanguageProviderNode.prototype.analyzePythonFinalExpression(code),
  },
  {
    name: "browser",
    analyze: (code: string) =>
      PyrightLanguageProviderBrowser.prototype.analyzePythonFinalExpression(
        code,
      ),
  },
];

describe("Pyright runtime parse-node tags", () => {
  it("uses the declared numeric values without relying on a const-enum runtime export", () => {
    assert.deepStrictEqual(PyrightParseNodeType, {
      Assignment: 3,
      AugmentedAssignment: 5,
      Await: 6,
      StatementList: 47,
      StringList: 48,
      String: 49,
      TypeAnnotation: 54,
      Yield: 60,
      YieldFrom: 61,
    });
    for (const { analyze } of analyzers) {
      assert.deepStrictEqual(analyze("42"), {
        isExpression: true,
        expressionText: "42",
        startOffset: 0,
        endOffset: 2,
      });
    }
  });
});

for (const { name, analyze } of analyzers) {
  describe(`Python final expression (${name})`, () => {
    for (const code of [
      "",
      "\n# comment\n",
      "a = 1",
      "a += 1",
      "a: int = 1",
      "a: int",
      "obj.attr: T",
      "from os import path",
      "await foo()",
      "yield x",
      "yield from x",
      "def f():\n    pass\n",
      "class A:\n    pass\n",
      "if True:\n    a + 2\n",
      "a +",
      "a =\na + 2",
      "import os",
      "pass",
    ]) {
      it(`does not display ${JSON.stringify(code)}`, () => {
        assert.deepStrictEqual(analyze(code), {
          isExpression: false,
        });
      });
    }

    for (const [code, expressionText, isModuleDocstring] of [
      ["a = 1\na + 2", "a + 2"],
      ["a + b\n\n\n", "a + b"],
      ["a + b\n# comment\n", "a + b"],
      ["a + b # comment", "a + b"],
      ["(a +\n b)\n", "(a +\n b)"],
      ["[\n  1,\n  2,\n]\n", "[\n  1,\n  2,\n]"],
      ["a = 1; a + 2\n", "a + 2"],
      ["a = 1\r\na + 2\r\n# comment", "a + 2"],
      ["name = '\ud83d\ude00'\nname", "name"],
      ["None", "None"],
      ["42", "42"],
      ['"hello"', '"hello"', true],
      ['"module docstring"', '"module docstring"', true],
      ['""', '""', true],
      ['r"hello"', 'r"hello"', true],
      ['u"hello"', 'u"hello"', true],
      ['("hello")', '("hello")', true],
      ['"hello" " world"', '"hello" " world"', true],
      ['f"{side_effect()}"', 'f"{side_effect()}"'],
      ['f"hello"', 'f"hello"'],
      ['"hello" f"{side_effect()}"', '"hello" f"{side_effect()}"'],
      ['b"hello"', 'b"hello"'],
      ['br"hello"', 'br"hello"'],
      ['pass\n"a"', '"a"'],
      ["True", "True"],
      ["...", "..."],
      ["(a := 1)", "(a := 1)"],
      ["a,", "a,"],
      ["a, # comment", "a,"],
      ["a, b,", "a, b,"],
      ["a, b , # comment", "a, b ,"],
      ["*items,", "*items,"],
      ["(a,)", "(a,)"],
      ["(x for x in y)", "(x for x in y)"],
      ["[x for x in y]", "[x for x in y]"],
      ['{\n "*": 1\n}', '{\n "*": 1\n}'],
      ["lambda x: x + 1", "lambda x: x + 1"],
      ["x if cond else y", "x if cond else y"],
    ] as const) {
      it(`detects ${JSON.stringify(code)}`, () => {
        const result = analyze(code);
        const startOffset = code.lastIndexOf(expressionText);
        assert.deepStrictEqual(result, {
          isExpression: true,
          expressionText,
          startOffset,
          endOffset: startOffset + expressionText.length,
          ...(isModuleDocstring ? { isModuleDocstring: true } : {}),
        });
      });
    }

    it("rejects oversized input", () => {
      for (const size of [100_001, 500_000, 1_000_000]) {
        assert.deepStrictEqual(analyze("a".repeat(size)), {
          isExpression: false,
        });
      }
    });

    it("accepts the exact size boundary and rejects deep or dense generated source", () => {
      assert.strictEqual(
        analyze("#" + "x".repeat(99_996) + "\n42").isExpression,
        true,
      );
      assert.strictEqual(
        analyze("(".repeat(128) + "42" + ")".repeat(128)).isExpression,
        true,
      );
      for (const source of [
        "(".repeat(129) + "42" + ")".repeat(129),
        "a = 1\n".repeat(700) + "42",
        "1+".repeat(1025) + "1",
      ]) {
        assert.deepStrictEqual(analyze(source), { isExpression: false });
      }
    });

    it("handles repeated requests without changing results", () => {
      for (let request = 0; request < 100; request++) {
        assert.strictEqual(analyze("a = 1\na + 2").expressionText, "a + 2");
      }
    });

    it("does not start parsing canceled or oversized requests", () => {
      const parse = sinon.stub().throws(new Error("must not parse"));
      for (const [source, cancelled] of [
        ["42", true],
        ["a".repeat(100_001), false],
      ] as const) {
        assert.deepStrictEqual(
          analyzePythonFinalExpression(
            source,
            parse,
            0,
            () => true,
            undefined,
            {
              isCancellationRequested: cancelled,
            },
          ),
          { isExpression: false },
        );
      }
      assert.strictEqual(parse.callCount, 0);
    });

    it("falls back when the parser throws", () => {
      assert.deepStrictEqual(
        analyzePythonFinalExpression(
          "a + 2",
          () => {
            throw new Error("parser unavailable");
          },
          0,
          () => false,
        ),
        { isExpression: false },
      );
    });
  });
}

describe("Python final expression request", () => {
  it("dispatches standalone source without changing document analysis state", async () => {
    const toServer = new PassThrough();
    const toClient = new PassThrough();
    const server = createConnection(
      new StreamMessageReader(toServer),
      new StreamMessageWriter(toClient),
    );
    const client = createProtocolConnection(
      new StreamMessageReader(toClient),
      new StreamMessageWriter(toServer),
    );
    const provider = sinon.createStubInstance(PyrightLanguageProviderNode);
    provider.getClientCapabilities.returns(Object.create(null));
    provider.initialize.resolves({ capabilities: {} });
    provider.analyzePythonFinalExpression.callsFake((code) =>
      PyrightLanguageProviderNode.prototype.analyzePythonFinalExpression(code),
    );
    try {
      runServer(server, provider);
      client.listen();
      await client.sendRequest("initialize", {
        processId: null,
        rootUri: null,
        capabilities: {},
      });
      await client.sendNotification("initialized", {});
      assert.deepStrictEqual(
        await client.sendRequest("sas/pythonFinalExpression", {
          code: "a = 1\na + 2",
        }),
        {
          isExpression: true,
          expressionText: "a + 2",
          startOffset: 6,
          endOffset: 11,
        },
      );
      assert.deepStrictEqual(
        await client.sendRequest("sas/pythonFinalExpression", { code: "a +" }),
        { isExpression: false },
      );
      assert.deepStrictEqual(
        await client.sendRequest("sas/pythonFinalExpression", {}),
        { isExpression: false },
      );
      assert.strictEqual(provider.addContentChange.callCount, 0);
      assert.strictEqual(provider.onDidOpenTextDocument.callCount, 0);
    } finally {
      client.dispose();
      server.dispose();
      toServer.destroy();
      toClient.destroy();
    }
  });
});
