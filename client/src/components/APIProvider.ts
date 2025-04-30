// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { authentication } from "vscode";

import { profileConfig } from "../commands/profile";
import { SASAuthProvider } from "./AuthProvider";
import { ConnectionType } from "./profile";

/* only Rest APIs for now */

const apis = {};

export const registerAPI = (name: string, fn) => {
  apis[name] = fn;
};

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
