// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ExtensionContext, Uri } from "vscode";

let context: ExtensionContext;

export function setContext(c: ExtensionContext) {
  context = c;
}

/**
 * Set an extension context value.
 */
export async function setContextValue(
  key: string,
  value: string,
): Promise<void> {
  context.workspaceState.update(key, value);
}

/**
 * Get an extension context value.
 */
export async function getContextValue(
  key: string,
): Promise<string | undefined> {
  return context.workspaceState.get(key);
}

export function getGlobalStorageUri(): Uri {
  return context.globalStorageUri;
}

export function getSecretStorage<T = string>(namespace: string) {
  const getNamespaceData = async (): Promise<Record<string, T> | undefined> => {
    const storedSessionData = await context.secrets.get(namespace);
    if (!storedSessionData) {
      return;
    }

    return JSON.parse(storedSessionData);
  };
  const setNamespaceData = async (data: Record<string, T>) => {
    await context.secrets.store(namespace, JSON.stringify(data));
  };

  const get = async (key: string): Promise<T | undefined> => {
    const data = await getNamespaceData();
    if (!data) {
      return;
    }

    return data[key];
  };

  const store = async (key: string, value: T) => {
    const data = await getNamespaceData();
    const newData = {
      ...(data || {}),
      [key]: value,
    };
    await context.secrets.store(namespace, JSON.stringify(newData));
  };

  return { setNamespaceData, getNamespaceData, get, store };
}
