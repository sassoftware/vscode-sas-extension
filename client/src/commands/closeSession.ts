// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { window } from "vscode";
import { closeSession as computeCloseSession } from "../viya/compute";

export async function closeSession(profileSwitch = false): Promise<void> {
  await computeCloseSession();
  if(!profileSwitch){
    window.showInformationMessage("Session closed!");
  }
}
