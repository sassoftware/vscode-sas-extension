// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri } from "vscode";

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

export const extractPathFromUri = (uri: string): string => {
  try {
    const queryStart = uri.indexOf("?");
    if (queryStart === -1) {
      return uri;
    }
    return uri.substring(0, queryStart);
  } catch (error) {
    console.error("Failed to extract path from URI:", error);
    return "";
  }
};

export const getDirectorySeparator = (path: string): string =>
  path.lastIndexOf("/") !== -1 ? "/" : "\\";

export const generateNewFilePath = (
  oldBasePath: string,
  closedFilePath: string,
  newItemUri: Uri,
  dirSeparator: string,
): Uri | null => {
  try {
    const relativePath = closedFilePath.substring(oldBasePath.length);
    const newUriStr = newItemUri.toString();

    // Extract the path without query parameters
    const queryStart = newUriStr.indexOf("?");
    const newPath =
      queryStart === -1 ? newUriStr : newUriStr.substring(0, queryStart);

    // Combine new path with relative path
    const newFilePath = newPath.endsWith(dirSeparator)
      ? newPath + relativePath.substring(1)
      : newPath + relativePath;

    // Reconstruct URI with query parameters if present
    if (queryStart !== -1) {
      const queryString = newUriStr.substring(queryStart);
      return Uri.parse(newFilePath + queryString);
    }

    return Uri.parse(newFilePath);
  } catch (error) {
    console.error("Failed to construct new file URI:", error);
    return null;
  }
};
