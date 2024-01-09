// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { LogState, initialState as initialLogState } from "./log/initialState";
import { RunState, initialState as initialRunState } from "./run/initialState";

export type AppStoreState = LogState & RunState;

export const initialState: AppStoreState = {
  ...initialLogState,
  ...initialRunState,
};
