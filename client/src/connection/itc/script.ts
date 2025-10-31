// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import powershellScript from "./itc.ps1";

type ScriptProperties = {
  interopLibraryFolderPath?: string;
};

export const getScript = ({
  interopLibraryFolderPath = "",
}: ScriptProperties) => `
Set-Location -Path "${__dirname}"
$global:interopLibraryFolderPath="${interopLibraryFolderPath}"

${powershellScript}
`;
