// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as fs from "fs";
import * as https from "https";
import * as tls from "tls";
import { workspace } from "vscode";

export const installCAs = () => {
  const certFiles: string[] = workspace
    .getConfiguration("SAS")
    .get("userProvidedCertificates");
  if (!certFiles || !certFiles.length) {
    return;
  }

  const userCertificates = [];
  for (const filename of certFiles) {
    if (filename && filename.length) {
      try {
        userCertificates.push(fs.readFileSync(filename));
      } catch (e) {
        console.log(`Failed to read user provided certificate`, e);
      }
    }
  }
  if (userCertificates.length > 0) {
    https.globalAgent.options.ca =
      tls.rootCertificates.concat(userCertificates);
  }
};
