// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Lexer, Token as RealToken } from "../Lexer";
import { type FoldingBlock, LexerEx } from "../LexerEx";
import type { Model } from "../Model";
import type { SyntaxProvider } from "../SyntaxProvider";
import { isSamePosition } from "../utils";

interface FakeToken extends Omit<RealToken, "type"> {
  type: "raw-data";
}
export type Token = FakeToken | RealToken;

export interface Statement {
  type: "statement";
  name: string;
  children: Token[];
  leadingComment?: Token;
}

export interface Region {
  type: "region";
  block?: FoldingBlock;
  children: (Region | Statement)[];
}

interface Program {
  type: "program";
  children: (Region | Statement)[];
}

export type SASAST = Program | Region | Statement | Token;

export const isComment = (token: Token) =>
  token.type === "comment" || token.type === "macro-comment";

const isAtBlockEnd = (block: FoldingBlock, token: Token) =>
  block.endLine === token.end.line && block.endCol === token.end.column;

const removePrevStatement = (parent: Program | Region) => {
  if (parent.children.length <= 1) {
    return;
  }
  let prevStatement = parent.children[parent.children.length - 2];
  if (prevStatement.type === "statement") {
    parent.children.splice(-2, 1);
    return;
  }
  while (prevStatement.type === "region") {
    parent = prevStatement;
    prevStatement = prevStatement.children[prevStatement.children.length - 1];
  }
  parent.children.pop();
};

const getBlockParent = (parents: Region[]) => {
  let index = parents.length - 1;
  while (index >= 0 && !parents[index].block) {
    index--;
  }
  return parents[index];
};

const hasParent = (parents: Region[], block: FoldingBlock) => {
  const parentBlock = getBlockParent(parents)?.block;
  if (!parentBlock) {
    return false;
  }
  while (block.outerBlock) {
    if (block.outerBlock === parentBlock) {
      return true;
    }
    block = block.outerBlock;
  }
  return false;
};

const isStartingRegion = (parents: Region[], currentStatement: Statement) => {
  if (/^%?do$/i.test(currentStatement.children[0].text)) {
    return true;
  }
  if (
    /^(%?if|%?else|when)$/i.test(currentStatement.children[0].text) &&
    currentStatement.children.length > 1
  ) {
    for (let i = 1; i < currentStatement.children.length - 1; i++) {
      if (/^%?do$/i.test(currentStatement.children[i].text)) {
        return true;
      }
    }
  }

  const parent = getBlockParent(parents);
  if (!parent || !parent.block) {
    return false;
  }

  const map: Record<string, RegExp> = {
    data: /^select$/i,
    ds2: /^(select|method|data|package|thread)$/i,
    template: /^(define|begingraph|layout)$/i,
  };

  const block = parent.block;
  let procName = "";
  if (block.name === "PROC") {
    const firstToken = parent.children[0].children[1];
    if (firstToken && "text" in firstToken) {
      procName = firstToken.text;
    }
  }
  const regexp = map[(procName || block.name).toLowerCase()];
  if (regexp && regexp.test(currentStatement.children[0].text)) {
    return true;
  }
  return false;
};

const preserveProcs = (
  current: number,
  region: Region,
  token: Token,
  model: Model,
) => {
  // should not format python/lua, treat it as raw data
  const lastStatement =
    region.children.length >= 2 &&
    region.children[region.children.length - 1].children;
  if (
    current === -1 &&
    region.block?.name === "PROC" &&
    lastStatement &&
    region.children[0].children.length > 0 &&
    lastStatement.length > 1 &&
    "text" in region.children[0].children[1] &&
    /^(python|lua)$/i.test(region.children[0].children[1].text) &&
    "text" in lastStatement[0] &&
    /^(submit|interactive|i)$/i.test(lastStatement[0].text)
  ) {
    current = 0;
  }
  if (current === 0 && /^(endsubmit|endinteractive)$/i.test(token.text)) {
    return 1;
  } else if (current === 1 && token.type === "sep" && token.text === ";") {
    current = 2;

    const start =
      "start" in region.children[1].children[0] &&
      region.children[1].children[0].start;
    const end = token.end;
    if (start) {
      region.children = [
        region.children[0],
        {
          type: "statement",
          name: "",
          children: [
            {
              type: "raw-data",
              text: model.getText({ start, end }),
              start,
              end,
            },
          ],
        },
      ];
    }
  } else if (current === 2) {
    current = -1;
  }
  return current;
};

const preserveQuoting = (
  current: number,
  statement: Statement,
  model: Model,
) => {
  const token = statement.children[statement.children.length - 1];
  if (isComment(token)) {
    return current;
  }

  if (
    current === -1 &&
    (Lexer.isQuoting[token.text.toUpperCase()] ||
      Lexer.isBQuoting[token.text.toUpperCase()])
  ) {
    return 0;
  } else if (current === 0 && token.text !== "(") {
    return -1;
  } else if (current >= 0) {
    statement.children.pop();
    if (token.text === "(") {
      if (++current === 1) {
        statement.children.push(token);
      }
    } else if (token.text === ")") {
      if (--current === 0) {
        const preToken = statement.children[statement.children.length - 1];
        const start = preToken.start;
        const end = token.end;
        statement.children.pop();
        statement.children.push({
          type: "text",
          text: model.getText({ start, end }),
          start,
          end,
        });
        return -1;
      }
    }
  }
  return current;
};

const preserveCustomRegion = (
  token: Token,
  context: ParserContext,
  model: Model,
  syntaxProvider: SyntaxProvider,
) => {
  let current = context.preserveCustom;
  if (current === -1) {
    if (isComment(token) && /\*\s*region\s+format-ignore\b/.test(token.text)) {
      const block = syntaxProvider.getFoldingBlock(
        token.start.line,
        token.start.column,
        true,
        false,
        true,
      );
      if (
        block &&
        block.type === LexerEx.SEC_TYPE.CUSTOM &&
        block.startLine === token.start.line &&
        block.startCol === token.start.column
      ) {
        current = 0;
        const start = token.start;
        const end = { line: block.endLine, column: block.endCol };
        if (!context.currentStatement) {
          context.startStatement(token.text);
        }
        context.currentStatement?.children.push({
          type: "raw-data",
          text: model.getText({ start, end }),
          start,
          end,
        });
      }
    }
  } else if (current === 0) {
    const statement = context.currentStatement;
    if (
      statement &&
      statement.children.length > 0 &&
      isSamePosition(
        token.end,
        statement.children[statement.children.length - 1].end,
      )
    ) {
      current = 1;
      context.endStatement();
    }
  } else if (current === 1) {
    return -1;
  }
  return current;
};

class ParserContext {
  readonly root: Program = {
    type: "program",
    children: [],
  };
  readonly parents: Region[] = [];
  region: Region | undefined = undefined;
  currentStatement: Statement | undefined = undefined;
  prevStatement: Statement | undefined = undefined;
  quoting = -1;
  preserveProc = -1;
  preserveCustom = -1;

  get parent() {
    return this.parents.length
      ? this.parents[this.parents.length - 1]
      : this.root;
  }
  get prevToken() {
    return this.prevStatement?.children[this.prevStatement.children.length - 1];
  }

  startRegion(block?: FoldingBlock) {
    if (block) {
      if (this.region && hasParent([...this.parents, this.region], block)) {
        this.parents.push(this.region);
      }
      this.region = {
        type: "region",
        block,
        children: [],
      };
      this.endStatement();
    } else {
      if (this.region) {
        this.region.children.pop();
        this.parents.push(this.region);
      } else {
        this.parent.children.pop();
      }
      this.region = {
        type: "region",
        children: [this.currentStatement!],
      };
    }
    this.parent.children.push(this.region);
  }

  endRegion() {
    this.region = this.parents.pop();
  }

  startStatement(name: string) {
    this.currentStatement = {
      type: "statement",
      name,
      children: [],
    };
    const parent = this.region ?? this.parent;
    parent.children.push(this.currentStatement);
  }

  endStatement() {
    if (this.currentStatement) {
      this.prevStatement = this.currentStatement;
      this.currentStatement = undefined;
    }
  }
}

export const getParser =
  (model: Model, tokens: Token[], syntaxProvider: SyntaxProvider) => () => {
    const context = new ParserContext();

    for (let i = 0; i < tokens.length; i++) {
      const node = tokens[i];

      //#region --- preserve special regions ---
      if (context.region && context.region.block) {
        context.preserveProc = preserveProcs(
          context.preserveProc,
          context.region,
          node,
          model,
        );
        if (context.preserveProc === 0 && i === tokens.length - 1) {
          // force finish at file end
          const fakeNode: Token = { ...node, text: ";", type: "sep" };
          if (node.text.endsWith("\n\n")) {
            // printer will add trailing new line
            fakeNode.end = { line: node.end.line - 1, column: 0 };
          }
          context.preserveProc = preserveProcs(
            1,
            context.region,
            fakeNode,
            model,
          );
        }
        if (context.preserveProc >= 0) {
          continue;
        }
      }
      if (node.type === "embedded-code") {
        continue;
      }
      context.preserveCustom = preserveCustomRegion(
        node,
        context,
        model,
        syntaxProvider,
      );
      if (context.preserveCustom >= 0) {
        continue;
      }
      //#endregion ---

      //#region --- Check for block start: DATA, PROC, %MACRO ---
      if (node.type === "sec-keyword" || node.type === "macro-sec-keyword") {
        const block = syntaxProvider.getFoldingBlock(
          node.start.line,
          node.start.column,
          true,
          true,
          true,
        );
        if (
          block &&
          block.startLine === node.start.line &&
          block.startCol === node.start.column
        ) {
          context.startRegion(block);
        }
      }
      //#endregion ---

      //#region --- Check for statement start ---
      const shouldStartStatement = !context.currentStatement;
      if (shouldStartStatement) {
        context.startStatement(node.text);
        if (
          context.currentStatement &&
          context.region?.children.length === 0 &&
          context.prevStatement?.children.length === 1 &&
          context.prevToken &&
          isComment(context.prevToken)
        ) {
          // leading comment will be printed together with current statement
          context.currentStatement.leadingComment = context.prevToken;
          // remove it from previous AST location
          removePrevStatement(context.parent);
        }
      }
      //#endregion ---

      if (!context.currentStatement) {
        throw new Error();
      }
      context.currentStatement.children.push(node);

      context.quoting = preserveQuoting(
        context.quoting,
        context.currentStatement,
        model,
      );
      if (context.quoting >= 0) {
        continue;
      }

      //#region --- Check for statement end ---
      if (node.type === "sep" && node.text === ";") {
        if (
          context.currentStatement.children[0].type === "cards-data" &&
          /(cards|lines|datalines|parmcards)4/i.test(
            (context.region && context.prevStatement?.name) ?? "",
          ) &&
          context.currentStatement.children.length < 5
        ) {
          // datalines4 requires ;;;; to end
          continue;
        }
        if (
          isStartingRegion(
            context.region
              ? [...context.parents, context.region]
              : context.parents,
            context.currentStatement,
          )
        ) {
          context.startRegion();
        } else if (
          context.region &&
          !context.region.block &&
          context.currentStatement.children.length > 1 &&
          /^(%?end|enddata|endpackage|endthread|endgraph|endlayout)$/i.test(
            context.currentStatement.children[
              context.currentStatement.children.length - 2
            ].text,
          )
        ) {
          // region end
          // put `end` out of region children to outdent
          context.parent.children.push(context.region.children.pop()!);
          context.endRegion();
        } else if (
          context.region?.block &&
          isAtBlockEnd(context.region.block, node)
        ) {
          // block end
          if (
            /^(run|quit|%mend)\b/i.test(
              context.currentStatement.children[0].text,
            )
          ) {
            // put `run` out of section children to outdent
            context.parent.children.push(context.region.children.pop()!);
          }
          context.endRegion();
        }
        if (i < tokens.length - 1) {
          const nextToken = tokens[i + 1];
          if (isComment(nextToken) && nextToken.end.line === node.end.line) {
            // trailing comment
            context.currentStatement.children.push(nextToken);
            ++i;
          }
          if (nextToken.start.line - node.end.line > 1) {
            // preserve user explicit empty line
            context.currentStatement.children.push({
              type: "raw-data",
              text: "\n",
              start: node.end,
              end: nextToken.start,
            });
          }
        }
        context.endStatement();
      } else if (
        context.currentStatement.children.length === 1 &&
        isComment(node)
      ) {
        // standalone comment, treat as a whole statement
        context.endStatement();
        if (context.region?.block && isAtBlockEnd(context.region.block, node)) {
          context.endRegion();
        }
      } else if (
        context.currentStatement.children.length === 2 &&
        node.type === "sep" &&
        node.text === ":" &&
        context.currentStatement.children[0].type === "text"
      ) {
        // label: treat as raw data
        context.currentStatement.children[0] = {
          ...context.currentStatement.children[0],
          type: "raw-data",
        };
        context.endStatement();
      }
      //#endregion ---
    }

    return context.root;
  };
