// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
export interface RunState {
  isExecutingCode: boolean;
  isUserExecuting: boolean;
}

export const initialState: RunState = {
  isExecutingCode: false,
  isUserExecuting: false,
};
