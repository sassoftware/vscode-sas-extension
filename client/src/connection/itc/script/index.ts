// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import fs from "fs";
import path from "path";

type ScriptProperties = {
  interopLibraryFolderPath?: string;
};

export const getScript = ({
  interopLibraryFolderPath = "",
}: ScriptProperties) => `
Set-Location -Path "${__dirname}"
$global:interopLibraryFolderPath="${interopLibraryFolderPath}"

${fs.readFileSync(path.join(__dirname, "itc.ps1")).toString()}
`;
