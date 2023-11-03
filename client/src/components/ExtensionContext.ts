// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ExtensionContext, Uri } from "vscode";

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

export async function setSecret(key: string, value: string): Promise<void> {
  await context.secrets.store(key, value);
}

export async function getSecret(key: string): Promise<string> {
  return await context.secrets.get(key);
}

export function getGlobalStorageUri(): Uri {
  return context.globalStorageUri;
}
