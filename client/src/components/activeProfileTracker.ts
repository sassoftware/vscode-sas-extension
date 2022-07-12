// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { FSWatcher } from "fs";
import { watch } from "chokidar";
import { closeSession } from "../viya/compute";

/**
 * Creates or replaces an {@link FSWatcher} to be used
 * for file watching.
 * @param watcher {@link FSWatcher} if an active watcher exists
 * @param configFile {@link string} used for new watcher location
 * @returns new {@link FSWatcher}
 */
export function createOrReplaceWatcher(
  watcher: FSWatcher,
  configFile: string,
  updateStatusBar: () => void
): FSWatcher {
  if (watcher) {
    watcher.close();
  }
  return watch(configFile).on("change", () => {
    // Do not alert user for profile switch
    closeSession();
    updateStatusBar();
  });
}
