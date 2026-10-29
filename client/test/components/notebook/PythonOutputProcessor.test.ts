import assert from "assert";

import { processPythonLog } from "../../../src/components/notebook/PythonOutputProcessor";
import type { LogLine } from "../../../src/connection";

describe("Python autodisplay output", () => {
  function normal(line: string): LogLine {
    return { type: "normal", line };
  }

  const id = "0123456789abcdef0123456789abcdef";
  const begin = `__SAS_AUTODISPLAY_${id}_BEGIN__`;
  const end = `__SAS_AUTODISPLAY_${id}_END__`;
  const frame = (text: string) => begin + JSON.stringify(text) + end;
  const framePayload = (payload: string) => begin + payload + end;

  it("preserves legacy marker-like user output", () => {
    const result = processPythonLog([
      normal(">>> "),
      normal("explicit output"),
      normal("__SAS_AUTODISPLAY__3"),
      normal("embedded __SAS_AUTODISPLAY__ text"),
      normal(">>> "),
    ]);
    assert.deepStrictEqual(result, {
      isPythonError: false,
      isSASError: false,
      outputLines: [
        normal("explicit output"),
        normal("__SAS_AUTODISPLAY__3"),
        normal("embedded __SAS_AUTODISPLAY__ text"),
      ],
      errorLines: [],
    });
  });

  for (const [text, expected] of [
    [frame("42"), ["42"]],
    [frame("'A \"quoted\" string'"), ["'A \"quoted\" string'"]],
    [
      framePayload(String.raw`"'\u3053\u3093\u306b\u3061\u306f'"`),
      ["'こんにちは'"],
    ],
    [framePayload(String.raw`"'\u4f60\u597d'"`), ["'你好'"]],
    [
      framePayload(String.raw`"'\uc548\ub155\ud558\uc138\uc694'"`),
      ["'안녕하세요'"],
    ],
    [framePayload(String.raw`"'\ud83d\ude00'"`), ["'😀'"]],
    [frame("'hello'"), ["'hello'"]],
    [frame("'hello world'"), ["'hello world'"]],
    [frame("\"He said 'hello'\""), ["\"He said 'hello'\""]],
    [frame("'\"nested quotes\"'"), ["'\"nested quotes\"'"]],
    [frame("['こんにちは']"), ["['こんにちは']"]],
    [frame("{'a': 'hello'}"), ["{'a': 'hello'}"]],
    [frame("('quoted',)"), ["('quoted',)"]],
    ["prefix" + frame("42"), ["prefix42"]],
    [frame("42") + "suffix", ["42suffix"]],
    [frame("first\nsecond"), ["first", "second"]],
    [frame("'line\\nbreak'"), ["'line\\nbreak'"]],
    [frame("'\\tindent'"), ["'\\tindent'"]],
    [frame("'\\\\slash'"), ["'\\\\slash'"]],
    [frame('quotes " and \\ and \ud800'), ['quotes " and \\ and \ud800']],
    [begin + '"unfinished"', [begin + '"unfinished"']],
    [begin + '"bad\\q"' + end, [begin + '"bad\\q"' + end]],
    [begin + "42" + end, [begin + "42" + end]],
    ["__SAS_AUTODISPLAY__hello", ["__SAS_AUTODISPLAY__hello"]],
    ["stdout" + frame("42") + "stderr", ["stdout42stderr"]],
  ] as const) {
    it(`decodes only a complete owned frame: ${JSON.stringify(text)}`, () => {
      const result = processPythonLog(
        [normal(">>> "), normal(text), normal(">>> ")],
        id,
      );
      assert.deepStrictEqual(result.outputLines, expected.map(normal));
    });
  }

  it("does not decode frames without ownership or with another execution's id", () => {
    const logs = [normal(">>> "), normal(frame("42")), normal(">>> ")];
    for (const otherId of [
      undefined,
      "fedcba9876543210fedcba9876543210",
      ".*",
    ]) {
      assert.deepStrictEqual(processPythonLog(logs, otherId).outputLines, [
        normal(frame("42")),
      ]);
    }
  });

  it("preserves multiple ordinary lines and whitespace around framed output", () => {
    const result = processPythonLog(
      [
        normal(">>> "),
        normal("first"),
        normal(""),
        normal(frame("42")),
        normal("last"),
        normal(">>> "),
      ],
      id,
    );
    assert.deepStrictEqual(result.outputLines, [
      normal("first"),
      normal(""),
      normal("42"),
      normal("last"),
    ]);
  });

  it("decodes frames split across log lines and preserves surrounding output lines", () => {
    for (const [completeFrame, expected] of [
      [frame("'A \"quoted\" string'"), "'A \"quoted\" string'"],
      [
        framePayload(String.raw`"'\u3053\u3093\u306b\u3061\u306f'"`),
        "'こんにちは'",
      ],
    ] as const) {
      for (const splitAt of [40, 80, 132]) {
        const log = [
          normal(">>> "),
          normal("before"),
          normal(completeFrame.slice(0, splitAt)),
          normal(completeFrame.slice(splitAt)),
          normal("after"),
          normal(">>> "),
        ];
        assert.deepStrictEqual(processPythonLog(log, id).outputLines, [
          normal("before"),
          normal(expected),
          normal("after"),
        ]);
      }
    }
  });

  it("preserves Python exception handling", () => {
    const result = processPythonLog([
      { type: "error", line: "ERROR: Unhandled Python exception." },
      normal(">>> "),
      normal("NameError: name 'missing' is not defined"),
      normal(">>> "),
    ]);
    assert.strictEqual(result.isPythonError, true);
    assert.deepStrictEqual(result.errorLines, [
      "NameError: name 'missing' is not defined",
    ]);
    assert.deepStrictEqual(result.outputLines, []);
  });

  it("preserves SAS errors and warnings", () => {
    const logs: LogLine[] = [
      { type: "error", line: "ERROR: Python is not configured." },
      { type: "warning", line: "WARNING: setup failed." },
    ];
    const result = processPythonLog(logs);
    assert.strictEqual(result.isSASError, true);
    assert.deepStrictEqual(result.outputLines, logs);
  });

  it("does not create output for an empty result", () => {
    assert.deepStrictEqual(
      processPythonLog([normal(">>> "), normal(">>> ")]).outputLines,
      [],
    );
  });
});
