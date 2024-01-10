// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { RunState } from "./initialState";

const selectIsExecutingCode = (store: RunState) => {
  return store.isExecutingCode;
};

export const runSelectors = {
  selectIsExecutingCode,
};
