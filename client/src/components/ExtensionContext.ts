// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ExtensionContext } from "vscode";

let context: ExtensionContext;

export function setContext(c: ExtensionContext) {
  context = c;
}

/*
 * Set an extension context value.
 */
export async function setContextValue(
  key: string,
  value: string,
): Promise<void> {
  context.workspaceState.update(key, value);
}

/*
 * Get an extension context value.
 */
export async function getContextValue(
  key: string,
): Promise<string | undefined> {
  return context.workspaceState.get(key);
}
