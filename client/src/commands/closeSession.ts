// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { window } from "vscode";

import { getSession } from "../connection";
import { Session } from "../connection/session";

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
