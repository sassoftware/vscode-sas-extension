// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
