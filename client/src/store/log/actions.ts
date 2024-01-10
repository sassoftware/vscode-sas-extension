// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { StateCreator } from "zustand/vanilla";

import type { Store } from "./store";

export interface LogActions {
  /**
   * Handles log lines generated for the SAS session execution.
   * @param logs array of log lines to write.
   */
  onOutputLog: (logs) => void;

  /**
   * Handles log lines generated for the SAS session startup.
   * @param logs array of log lines to write.
   */
  onOutputSessionLog: (logs) => void;

  /**
   * Removes all entries from data log tokens and logs.
   */
  clearLog: () => void;

  /**
   * Resets producedExecutionOutput to its default value.
   */
  unsetProducedExecutionOutput: () => void;
}

export const createLogActions: StateCreator<Store, [], [], LogActions> = (
  set,
  get,
) => ({
  onOutputLog: (logs) => {
    const tokens = logs.map((x) => x.type);
    set((existing) => ({
      logTokens: [...existing.logTokens, ...tokens],
    }));

    set((existing) => ({ logLines: [...existing.logLines, ...logs] }));

    if (!get().producedExecutionOutput) {
      set({ producedExecutionOutput: true });
    }
  },

  onOutputSessionLog: (logs) => {
    const tokens = logs.map((x) => x.type);
    set((existing) => ({
      logTokens: [...existing.logTokens, ...tokens],
    }));
    set((existing) => ({ logLines: [...existing.logLines, ...logs] }));
  },

  clearLog: () => set({ logTokens: [], logLines: [] }),

  unsetProducedExecutionOutput: () => set({ producedExecutionOutput: false }),
});
