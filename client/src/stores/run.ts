// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { subscribeWithSelector } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

interface RunState {
  isRunning: boolean;
  setIsRunning: (status: RunState["isRunning"]) => void;
}

const runStore = createStore(
  subscribeWithSelector<RunState>((set) => ({
    isRunning: false,
    setIsRunning: (status) => set({ isRunning: status }),
  })),
);

export const { getState, setState, subscribe } = runStore;
export default runStore;
