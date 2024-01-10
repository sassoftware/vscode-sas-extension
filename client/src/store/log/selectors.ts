// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { LogState } from "./initialState";

const selectLogLines = (store: LogState) => {
  return store.logLines;
};

const selectProducedExecutionOutput = (store: LogState) => {
  return store.producedExecutionOutput;
};

export const logSelectors = {
  selectLogLines,
  selectProducedExecutionOutput,
};
