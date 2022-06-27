// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { readFileSync } from "fs";
import * as path from "path";

export const ResLoader = {
  // eslint-disable-next-line
  get: function (url: string, cb: (arg0: any) => void, async?: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cb(require(url));
  },
  getBundle: function (locale: string): string {
    return readFileSync(
      path.resolve(__dirname, `../../messagebundle_${locale}.properties`)
    ).toString();
  },
};
