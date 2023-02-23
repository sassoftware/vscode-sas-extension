// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { LogLine } from "./rest/api/compute";
import { getSession as getRestSession } from "./rest";
import { getSession as getSSHSession } from "./ssh";
import {
  AuthType,
  ConnectionType,
  ProfileConfig,
  SSHProfile,
  ViyaProfile,
} from "../components/profile";

let profileConfig: ProfileConfig;

export interface RunResult {
  html5?: string;
  title?: string;
}

export interface Session {
  setup(): Promise<void>;
  run(code: string, onLog?: (logs: LogLine[]) => void): Promise<RunResult>;
  close(): Promise<void> | void;
}

export function getSession(): Session {
  if (!profileConfig) {
    profileConfig = new ProfileConfig();
  }
  // retrieve active & valid profile
  const activeProfile = profileConfig.getActiveProfileDetail();
  const validProfile = profileConfig.validateProfile(activeProfile);

  if (validProfile.type === AuthType.Error) {
    throw new Error(validProfile.error);
  }
  if (validProfile.profile?.connectionType === ConnectionType.Rest) {
    return getRestSession(validProfile.profile as ViyaProfile);
  } else if (validProfile.profile?.connectionType === ConnectionType.SSH) {
    return getSSHSession(validProfile.profile as SSHProfile);
  }

  throw new Error("Invalid endpoint");
}
