// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "fs";
import * as path from "path";

export const ResLoader = {
  // eslint-disable-next-line
  get: function (url: string, cb: (arg0: any) => void, async?: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cb(require(url));
  },
  getBundle: function (locale: string): string {
    return readFileSync(
      path.resolve(__dirname, `../../messagebundle_${locale}.properties`),
    ).toString();
  },
};
