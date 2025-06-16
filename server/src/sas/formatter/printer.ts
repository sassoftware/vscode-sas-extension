// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { Doc, Printer } from "prettier";
import { builders, utils } from "prettier/doc";

import { isSamePosition } from "../utils";
import { SASAST, Statement, Token, isComment } from "./parser";

const {
  fill,
  hardline,
  indent,
  join,
  line,
  literalline,
  markAsRoot,
  softline,
} = builders;

const isRootAlign = (doc: Doc) =>
  typeof doc === "object" &&
  "type" in doc &&
  doc.type === "align" &&
  typeof doc.n === "object" &&
  doc.n.type === "root";

const isEqualsSign = (token: Token) =>
  token.type === "sep" && token.text === "=";

const startsWithLineBreak = (doc: Doc) => {
  while (Array.isArray(doc)) {
    doc = doc[0];
  }
  return typeof doc === "object" && "type" in doc && doc.type === "line";
};

export const print: Printer<SASAST>["print"] = (path, options, print) => {
  const { node } = path;
  if ("children" in node && node.children?.length) {
    if (node.type === "statement") {
      return printStatement(node);
    }
    const children = removeRedundantLineBreaks(
      path.map(print, "children").filter((doc) => doc !== ""),
    );
    if (node.type === "region") {
      const region = printRegion(children);
      return !(
        path.isFirst ||
        (path.index === 1 && path.parent?.type === "region")
      ) && node.block
        ? [hardline, ...region]
        : region;
    }
    children[children.length - 1] = utils.stripTrailingHardline(
      children[children.length - 1],
    );
    return [...join(line, children), literalline];
  }
  return "text" in node ? node.text : "";
};

const printRegion = (children: Doc[]) => {
  const [first, ...others] = children;
  return [
    first,
    indent(
      others.reduce<Doc[]>(
        (pre, doc) => [...pre, isRootAlign(doc) ? literalline : line, doc],
        [],
      ),
    ),
  ];
};

const printStatement = (node: Statement) => {
  const [first, ...others] = node.children;
  const statement =
    first.type === "cards-data" || first.type === "raw-data"
      ? markAsRoot(node.children.map((token) => token.text))
      : fill(
          // Note: `fill` requires elements with odd indices must be line breaks
          // Refers to https://github.com/prettier/prettier/blob/main/commands.md#fill
          others.reduce<Doc[]>(
            (pre, token, index) => {
              const preToken = index === 0 ? first : others[index - 1];
              if (
                typeof pre[pre.length - 1] === "string" &&
                isSamePosition(token.start, preToken.end)
              ) {
                // do not break if no whitespace
                pre[pre.length - 1] += token.text;
                return pre;
              }
              return [
                ...pre,
                indent(
                  isEqualsSign(token) ||
                    (isEqualsSign(preToken) &&
                      index + 1 < others.length &&
                      !isEqualsSign(others[index + 1]))
                    ? // trim whitespace around equals sign
                      softline
                    : line,
                ),
                token.text,
              ];
            },
            [isComment(first) ? printComment(first) : first.text],
          ),
        );
  return node.leadingComment
    ? [printComment(node.leadingComment), hardline, statement]
    : statement;
};

const printComment = (token: Token) => {
  const text = token.text.split("\n");
  if (text.length === 0 || !token.text.startsWith("/*")) {
    return token.text;
  }
  return join(
    hardline,
    text.map((line) => line.trim().replace(/^\*/, " *")),
  );
};

const removeRedundantLineBreaks = (docs: Doc[]) =>
  docs.map((doc, index) =>
    index < docs.length - 1 && startsWithLineBreak(docs[index + 1])
      ? utils.stripTrailingHardline(doc)
      : doc,
  );
