// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { Doc, Printer } from "prettier";
import { builders, utils } from "prettier/doc";

import { isSamePosition } from "../utils";
import type { SASAST, Statement } from "./parser";

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
      return !path.isFirst && node.block ? [hardline, ...region] : region;
    }
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
  const tokens = node.children;
  const statement =
    tokens[0].type === "cards-data" || tokens[0].type === "raw-data"
      ? markAsRoot(tokens.map((token) => token.text))
      : fill(
          tokens.map((token, index) =>
            index > 0 && !isSamePosition(token.start, tokens[index - 1].end)
              ? indent([
                  token.text === "=" ||
                  (tokens[index - 1].text === "=" &&
                    index + 1 < tokens.length &&
                    tokens[index + 1].text !== "=")
                    ? softline
                    : line,
                  token.text,
                ])
              : token.text,
          ),
        );
  return node.leadingComment
    ? [node.leadingComment.text, hardline, statement]
    : statement;
};

const removeRedundantLineBreaks = (docs: Doc[]) =>
  docs.map((doc, index) =>
    index < docs.length - 1 && startsWithLineBreak(docs[index + 1])
      ? utils.stripTrailingHardline(doc)
      : doc,
  );
