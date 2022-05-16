// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

export const ResLoader = {
  // eslint-disable-next-line
  get: function (url: string, cb: (arg0: any) => void, async?: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cb(require(url));
  },
};
