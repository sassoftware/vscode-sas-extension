// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TableQuery } from "../../components/LibraryNavigator/types";

export const decodeEntities = (msg: string): string => {
  // Some of our messages from the server contain html encoded
  // characters. This converts them back.
  const specialCharacters = {
    "&apos;": "'",
  };

  Object.entries(specialCharacters).map(([encodedHtml, text]) => {
    msg = msg.replace(encodedHtml, text);
  });

  return msg;
};

export const escapePowershellString = (unescapedString: string): string =>
  unescapedString.replace(/(`|"|'|\$|\(|\)|%|{|}|\[|\])/g, "`$1");

export const getDirectorySeparator = (path: string): string =>
  path.lastIndexOf("/") !== -1 ? "/" : "\\";

export const sanitizePowershellString = (
  query: TableQuery | undefined,
): string => {
  let cleanQuery: TableQuery = { filterValue: "" };
  if (!query) {
    return "";
  }

  // Sanitize empty strings to null AND convert single quotes to escaped double quotes
  cleanQuery = {
    ...query,
    filterValue:
      !query.filterValue || query.filterValue.trim() === ""
        ? ""
        : query.filterValue.replace(/'/g, '"'),
  };
  return JSON.stringify(cleanQuery);
};
