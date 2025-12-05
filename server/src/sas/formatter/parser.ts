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

const isAtBlockEnd = (block: FoldingBlock | undefined, token: Token) =>
  block &&
  block.endLine === token.end.line &&
  block.endCol === token.end.column;

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
  // should not format python/R/lua, treat it as raw data
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
    /^(python|lua|rlang)$/i.test(region.children[0].children[1].text) &&
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

const preserveCustomRegion = (
  current: number,
  statement: Statement,
  model: Model,
  syntaxProvider: SyntaxProvider,
) => {
  const token = statement.children[statement.children.length - 1];
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
        statement.children.pop();
        statement.children.push({
          type: "raw-data",
          text: model.getText({ start, end }),
          start,
          end,
        });
      }
    }
  } else if (current === 0) {
    statement.children.pop();
    if (
      statement &&
      statement.children.length > 0 &&
      isSamePosition(
        token.end,
        statement.children[statement.children.length - 1].end,
      )
    ) {
      current = 1;
    }
  } else if (current === 1) {
    return -1;
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

export const getParser =
  (model: Model, tokens: Token[], syntaxProvider: SyntaxProvider) => () => {
    const root: Program = {
      type: "program",
      children: [],
    };
    const parents: Region[] = [];
    let region: Region | undefined = undefined;
    let currentStatement: Statement | undefined = undefined;
    let prevStatement: Statement | undefined = undefined;
    let quoting = -1;
    let preserveProc = -1;
    let preserveCustom = -1;

    for (let i = 0; i < tokens.length; i++) {
      const node = tokens[i];
      let parent = parents.length ? parents[parents.length - 1] : root;

      //#region --- Preserve Python/R/Lua
      if (region && region.block) {
        preserveProc = preserveProcs(preserveProc, region, node, model);
        if (preserveProc === 0 && i === tokens.length - 1) {
          // force finish at file end
          const fakeNode: Token = { ...node, text: ";", type: "sep" };
          if (node.text.endsWith("\n\n")) {
            // printer will add trailing new line
            fakeNode.end = { line: node.end.line - 1, column: 0 };
          }
          preserveProc = preserveProcs(1, region, fakeNode, model);
        }
        if (preserveProc >= 0) {
          continue;
        }
      }
      if (node.type === "embedded-code") {
        continue;
      }
      //#endregion ---

      //#region --- Check for block start: DATA, PROC, %MACRO
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
          if (region && hasParent([...parents, region], block)) {
            parents.push(region);
            parent = region;
          }
          region = {
            type: "region",
            block: block,
            children: [],
          };
          parent.children.push(region);
          if (currentStatement) {
            prevStatement = currentStatement;
            currentStatement = undefined;
          }
        }
      }
      //#endregion ---

      //#region --- Check for statement start
      if (!currentStatement) {
        currentStatement = {
          type: "statement",
          name: node.text,
          children: [],
        };
        if (region) {
          if (region.children.length === 0 && prevStatement) {
            const prevToken =
              prevStatement.children[prevStatement.children.length - 1];
            if (prevStatement.children.length === 1 && isComment(prevToken)) {
              // leading comment will be printed together with current statement
              currentStatement.leadingComment = prevToken;
              // remove it from previous AST location
              removePrevStatement(parent);
            }
          }
          region.children.push(currentStatement);
        } else {
          parent.children.push(currentStatement);
        }
      }
      //#endregion ---

      currentStatement.children.push(node);

      preserveCustom = preserveCustomRegion(
        preserveCustom,
        currentStatement,
        model,
        syntaxProvider,
      );
      if (preserveCustom >= 0) {
        if (preserveCustom === 1) {
          prevStatement = currentStatement;
          currentStatement = undefined;
        }
        continue;
      }

      quoting = preserveQuoting(quoting, currentStatement, model);
      if (quoting >= 0) {
        continue;
      }

      //#region --- Check for statement end
      if (node.type === "sep" && node.text === ";") {
        if (
          currentStatement.children[0].type === "cards-data" &&
          /(cards|lines|datalines|parmcards)4/i.test(
            (region && prevStatement?.name) ?? "",
          ) &&
          currentStatement.children.length < 5
        ) {
          // datalines4 requires ;;;; to end
          continue;
        }
        if (
          isStartingRegion(
            region ? [...parents, region] : parents,
            currentStatement,
          )
        ) {
          if (region) {
            region.children.pop();
            parents.push(region);
            parent = region;
          } else {
            parent.children.pop();
          }
          region = {
            type: "region",
            children: [currentStatement],
          };
          parent.children.push(region);
        } else if (
          region &&
          !region.block &&
          currentStatement.children.length > 1 &&
          /^(%?end|enddata|endpackage|endthread|endgraph|endlayout)$/i.test(
            currentStatement.children[currentStatement.children.length - 2]
              .text,
          )
        ) {
          // region end
          // put `end` out of region children to outdent
          parent.children.push(region.children.pop()!);
          region = parents.pop();
        } else if (region && isAtBlockEnd(region.block, node)) {
          // block end
          if (/^(run|quit|%mend)\b/i.test(currentStatement.children[0].text)) {
            // put `run` out of section children to outdent
            parent.children.push(region.children.pop()!);
          }
          region = parents.pop();
        }
        if (i < tokens.length - 1) {
          const nextToken = tokens[i + 1];
          if (isComment(nextToken) && nextToken.end.line === node.end.line) {
            // trailing comment
            currentStatement.children.push(nextToken);
            ++i;
          }
          if (nextToken.start.line - node.end.line > 1) {
            // preserve user explicit empty line
            currentStatement.children.push({
              type: "raw-data",
              text: "\n",
              start: node.end,
              end: nextToken.start,
            });
          }
        }
        prevStatement = currentStatement;
        currentStatement = undefined;
      } else if (currentStatement.children.length === 1 && isComment(node)) {
        // standalone comment, treat as a whole statement
        prevStatement = currentStatement;
        currentStatement = undefined;
        if (isAtBlockEnd(region?.block, node)) {
          region = parents.pop();
        }
      } else if (
        currentStatement.children.length === 2 &&
        node.type === "sep" &&
        node.text === ":" &&
        currentStatement.children[0].type === "text"
      ) {
        // label: treat as raw data
        currentStatement.children[0] = {
          ...currentStatement.children[0],
          type: "raw-data",
        };
        prevStatement = currentStatement;
        currentStatement = undefined;
      }
      //#endregion ---
    }

    return root;
  };
