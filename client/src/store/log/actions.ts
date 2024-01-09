// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { StateCreator } from "zustand/vanilla";

import { showLogOnExecutionStart } from "../../components/utils/settings";
import { AppStore } from "../store";

export interface LogActions {
  /**
   * Handles log lines generated for the SAS session execution by appending to the output channel,
   * in addition to conditionally showing the panel based on user settings.
   * @param logs array of log lines to write.
   * @returns
   */
  onOutputLog: (logs) => void;

  /**
   * Handles log lines generated for the SAS session startup by appending to the output channel.
   * @param logs array of log lines to write.
   * @returns
   */
  onOutputSessionLog: (logs) => void;

  /**
   * Removes all entries from data log tokens.
   * @returns
   */
  clearDataLogTokens: () => void;

  /**
   *
   * @param boolean true if the SAS Log should be made visible to the UI, false otherwise.
   */
  toggleOutputLogVisible: (shouldOpenOutputChannel: boolean) => void;
}

export const createLogActions: StateCreator<AppStore, [], [], LogActions> = (
  set,
  get,
) => ({
  onOutputLog: (logs) => {
    const tokens = logs.map((x) => x.type);
    set((existing) => ({
      logTokens: [...existing.logTokens, ...tokens],
    }));

    set((existing) => ({ logLines: [...existing.logLines, ...logs] }));

    //The session is executing code and log has been produced for the first time
    if (get().isExecutingCode && !get().producedExecutionOutput) {
      set({ producedExecutionOutput: true });

      if (showLogOnExecutionStart()) {
        get().toggleOutputLogVisible(true);
      }
    }
  },

  onOutputSessionLog: (logs) => {
    const tokens = logs.map((x) => x.type);
    set((existing) => ({
      logTokens: [...existing.logTokens, ...tokens],
    }));
    set((existing) => ({ logLines: [...existing.logLines, ...logs] }));
  },

  clearDataLogTokens: () => set({ logTokens: [], logLines: [] }),

  toggleOutputLogVisible: (shouldOpenOutputChannel) => {
    set({ shouldOpenOutputChannel });
    if (shouldOpenOutputChannel) {
      set({
        shouldOpenOutputChannel: false,
      });
    }
  },
});
