// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { subscribeWithSelector } from "zustand/middleware";
import { StateCreator, createStore } from "zustand/vanilla";

import { AppStoreState, initialState } from "./initialState";
import { createLogActions } from "./log/actions";
import { LogActions } from "./log/actions";
import { logger } from "./middleware";
import { createRunActions } from "./run/actions";
import { RunActions } from "./run/actions";

export type AppActions = LogActions & RunActions;
export type AppStore = AppActions & AppStoreState;

const store: StateCreator<AppStore, []> = (...params) => ({
  ...initialState,

  ...createLogActions(...params),
  ...createRunActions(...params),
});

export const useStore = createStore<AppStore>()(
  subscribeWithSelector(logger(store)),
);
