// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { ProfileConfig } from "../viya/profile";
import { FSWatcher, watch } from "fs";

let watcher: FSWatcher;

export function create(
  profileConfig: ProfileConfig,
  configFile: string,
  updateStatusBar: () => void
): void {
  if (watcher) {
    watcher.close();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  watcher = watch(configFile, (eventType, _) => {
    if (eventType === "rename") {
      // Do nothing
    } else {
      getActiveProfileName(profileConfig);
      updateStatusBar();
    }
  });
}

async function getActiveProfileName(
  profileConfig: ProfileConfig
): Promise<string | null> {
  const profile = await profileConfig.getActiveProfile();
  if (!profile) {
    return null;
  }
  return profile.name;
}
