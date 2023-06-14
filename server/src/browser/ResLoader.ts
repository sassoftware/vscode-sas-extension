// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const ResLoader = {
  // eslint-disable-next-line
  get: function (url: string, cb: (arg0: any) => void, async?: boolean) {
    // have to explicitly write path for webpack to bundle
    const index = url.indexOf("/data/");
    if (index > 0) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      cb(require(`../../data/${url.slice(index + 6)}`));
    } else {
      const index = url.indexOf("/pubsdata/");
      if (index > 0) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        cb(require(`../../pubsdata/${url.slice(index + 10)}`));
      }
    }
  },
  getBundle: function (locale: string): string {
    return require(`../../messagebundle_${locale}.properties`);
  },
};
