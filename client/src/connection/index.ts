// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AuthType,
  ConnectionType,
  ProfileConfig,
  ViyaProfile,
  toAutoExecLines,
} from "../components/profile";
import { getSession as getCOMSession } from "./com";
import { Config as RestConfig, getSession as getRestSession } from "./rest";
import {
  LogLine as ComputeLogLine,
  LogLineTypeEnum as ComputeLogLineTypeEnum,
} from "./rest/api/compute";
import { Session } from "./session";
import { getSession as getSSHSession } from "./ssh";

let profileConfig: ProfileConfig;

export type LogLine = ComputeLogLine;
export type LogLineTypeEnum = ComputeLogLineTypeEnum;
export type OnLogFn = (logs: LogLine[]) => void;

export interface RunResult {
  html5?: string;
  title?: string;
}

export interface BaseConfig {
  sasOptions?: string[];
  autoExecLines?: string[];
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

  switch (validProfile.profile?.connectionType) {
    case ConnectionType.Rest:
      return getRestSession(toRestConfig(validProfile.profile));
    case ConnectionType.SSH:
      return getSSHSession(validProfile.profile);
    case ConnectionType.COM:
      return getCOMSession(validProfile.profile);
    default:
      throw new Error("Invalid connectionType. Check Profile settings.");
  }
}

/**
 * Translates a {@link ViyaProfile} interface to a {@link RestConfig} interface.
 * @param profile an input {@link ViyaProfile} to translate.
 * @returns RestConfig instance derived from the input profile.
 */
function toRestConfig(profile: ViyaProfile): RestConfig {
  const mapped: RestConfig = profile;
  if (profile.autoExec) {
    mapped.autoExecLines = toAutoExecLines(profile.autoExec);
  }
  return mapped;
}
