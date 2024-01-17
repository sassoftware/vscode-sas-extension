// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//TODO: when session is refactored to flux pattern, types will move over

export interface LogState {
  producedExecutionOutput: boolean;
}

export const initialState: LogState = {
  producedExecutionOutput: false,
};
