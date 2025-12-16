// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextDocument } from "vscode-languageserver-textdocument";

import { LanguageServiceProvider } from "../sas/LanguageServiceProvider";
import { extractEmbeddedLanguageCode } from "../utils/embeddedLanguageUtils";

export const extractPythonCodes = (
  doc: TextDocument,
  languageService: LanguageServiceProvider,
): string => {
  return extractEmbeddedLanguageCode(doc, languageService, {
    procName: "PROC PYTHON",
    headerLines: ["import sas2py;SAS = sas2py.SAS2py() #type: ignore"],
    footerLines: ["pass"],
  });
};
