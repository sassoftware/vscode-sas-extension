// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { window } from "vscode";
import { closeSession as computeCloseSession } from "../viya/compute";

export async function switchProfile(): Promise<void> {
    await window.showQuickPick(
        ['shell', 'fetch rows, list in table'],
        { placeHolder: 'select type of web page to make' }
    );

}