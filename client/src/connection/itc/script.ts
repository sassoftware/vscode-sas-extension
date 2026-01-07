// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//import powershellScript from "./itc.ps1";
import fs from "fs";
import path from "path";

type ScriptProperties = {
  interopLibraryFolderPath?: string;
};

const ps1Script = fs.readFileSync(path.join(__dirname, "itc.ps1")).toString();

export const getScript = ({
  interopLibraryFolderPath = "",
}: ScriptProperties) => `
Set-Location -Path "${__dirname}"
$global:interopLibraryFolderPath="${interopLibraryFolderPath}"

${ps1Script}
`;
