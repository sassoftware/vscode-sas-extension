// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { subscribeWithSelector } from "zustand/middleware";
import { StateCreator, createStore } from "zustand/vanilla";

import { RunActions, createRunActions } from "./actions";
import { RunState, initialState } from "./initialState";

export type Store = RunState & RunActions;

const createdStore: StateCreator<Store, []> = (...parameters) => ({
  ...initialState,
  ...createRunActions(...parameters),
});

export const useStore = createStore<Store>()(
  subscribeWithSelector(createdStore),
);
