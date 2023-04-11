// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

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

  const CAs = [].concat(tls.rootCertificates);
  const originalLength = CAs.length;
  for (const filename of certFiles) {
    if (filename && filename.length) {
      try {
        CAs.push(fs.readFileSync(filename));
      } catch (e) {
        console.log(`Failed to read user provided certificate`, e);
      }
    }
  }
  if (CAs.length !== originalLength) {
    https.globalAgent.options.ca = CAs;
  }
};
