// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { authentication } from "vscode";

import { profileConfig } from "../commands/profile";
import { SASAuthProvider } from "./AuthProvider";
import { ConnectionType } from "./profile";

/* only Rest APIs for now */

const apis: Record<string, (...args: unknown[]) => unknown> = {};

export const registerAPI = (name: string, fn) => {
  apis[name] = fn;
};

// used internally (e.g. by the language client) to invoke a registered API directly
export const getAPI = (name: string) => apis[name];

export const getRestAPIs = async (accessToken: string) => {
  const activeProfile = profileConfig.getProfileByName(
    profileConfig.getActiveProfile(),
  );
  if (!activeProfile || activeProfile.connectionType !== ConnectionType.Rest) {
    return;
  }
  const session = await authentication.getSession(SASAuthProvider.id, [], {
    silent: true,
  });
  if (session.accessToken !== accessToken) {
    return;
  }

  return apis;
};
