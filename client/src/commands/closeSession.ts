// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf
import { window } from "vscode";
import { getSession, Session } from "../connection";

export async function closeSession(message?: string): Promise<void> {
  let session: Session;
  try {
    session = getSession();
  } catch {
    // no session, do nothing
  }
  await session?.close();
  if (message) {
    window.showInformationMessage(message);
  }
}
