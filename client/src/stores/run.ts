// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { subscribeWithSelector } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

interface RunState {
  hasProducedLogOutput: boolean;
  isRunning: boolean;
  setRunning: () => void;
  setDoneRunning: () => void;
  setProducedLogOutput: () => void;
  unsetProducedLogOutput: () => void;
}

const runStore = createStore(
  subscribeWithSelector<RunState>((set) => ({
    hasProducedLogOutput: false,
    isRunning: false,
    setRunning: () => set({ isRunning: true }),
    setDoneRunning: () => set({ isRunning: false }),
    setProducedLogOutput: () => set({ hasProducedLogOutput: true }),
    unsetProducedLogOutput: () => set({ hasProducedLogOutput: false }),
  })),
);

export const { getState, setState, subscribe } = runStore;
export default runStore;
