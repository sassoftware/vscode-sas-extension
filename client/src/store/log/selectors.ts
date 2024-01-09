// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { AppStoreState } from "../initialState";

const selectIsOutputChannelOpen = (store: AppStoreState) => {
  return store.shouldOpenOutputChannel;
};

const selectLogLines = (store: AppStoreState) => {
  return store.logLines;
};

export const logSelectors = {
  selectIsOutputChannelOpen,
  selectLogLines,
};
