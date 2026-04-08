export interface PythonFinalExpression {
  isExpression: boolean;
  expressionText?: string;
  startOffset?: number;
  endOffset?: number;
  isModuleDocstring?: boolean;
}

// Pyright declares ParseNodeType as a const enum and omits it from runtime JS exports.
export const PyrightParseNodeType = {
  Assignment: 3,
  AugmentedAssignment: 5,
  Await: 6,
  StatementList: 47,
  StringList: 48,
  String: 49,
  TypeAnnotation: 54,
  Yield: 60,
  YieldFrom: 61,
} as const;

const pyrightBytesStringFlag = 32;

export function analyzePythonFinalExpression<
  Expression extends {
    start: number;
    length: number;
    nodeType: number;
    strings?: { nodeType: number; token: { flags: number } }[];
  },
  Statement extends { nodeType: number; statements?: Expression[] },
>(
  code: string,
  parse: (code: string) => {
    parseTree: { statements: Statement[] };
    hasErrors: boolean;
  },
  statementListType: number,
  isExpression: (node: Expression) => boolean,
  stringListType?: number,
  token?: { isCancellationRequested: boolean },
): PythonFinalExpression {
  if (
    typeof code !== "string" ||
    token?.isCancellationRequested ||
    code.length > 100_000 ||
    (code.match(/[()[\]{}]/g)?.length ?? 0) > 256 ||
    (code.match(/[;+=*/%&|^<>,:-]/g)?.length ?? 0) > 1024 ||
    (code.match(/\S+/g)?.length ?? 0) > 2000
  ) {
    return { isExpression: false };
  }
  try {
    const result = parse(code);
    if (result.hasErrors || token?.isCancellationRequested) {
      return { isExpression: false };
    }

    const statements = result.parseTree.statements;
    const lastStatement = statements[statements.length - 1];
    if (
      lastStatement?.nodeType !== statementListType ||
      !lastStatement.statements
    ) {
      return { isExpression: false };
    }
    const expression =
      lastStatement.statements[lastStatement.statements.length - 1];
    if (!expression || !isExpression(expression)) {
      return { isExpression: false };
    }
    const isModuleDocstring =
      expression.nodeType === stringListType &&
      statements[0]?.statements?.[0] === expression &&
      !!expression.strings?.length &&
      expression.strings.every(
        (string) =>
          string.nodeType === PyrightParseNodeType.String &&
          (string.token.flags & pyrightBytesStringFlag) === 0,
      );

    const startOffset = expression.start;
    let endOffset = startOffset + expression.length;
    const trailingComma = /^[ \t]*,/.exec(code.slice(endOffset));
    if (trailingComma) {
      endOffset += trailingComma[0].length;
    }
    const expressionText = code.slice(startOffset, endOffset);
    const wrapped = parse(`(${expressionText})`);
    const wrappedExpression = wrapped.parseTree.statements[0]?.statements?.[0];
    if (
      wrapped.hasErrors ||
      token?.isCancellationRequested ||
      wrappedExpression?.nodeType !== expression.nodeType
    ) {
      return { isExpression: false };
    }
    return {
      isExpression: true,
      expressionText,
      startOffset,
      endOffset,
      ...(isModuleDocstring ? { isModuleDocstring: true } : {}),
    };
  } catch {
    return { isExpression: false };
  }
}
