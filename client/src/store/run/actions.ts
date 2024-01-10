// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { StateCreator } from "zustand/vanilla";

import { type Store } from "./store";

export interface RunActions {
  toggleIsExecutingCode: (isExecuting: boolean) => void;
}

export const createRunActions: StateCreator<Store, [], [], RunActions> = (
  set,
) => ({
  toggleIsExecutingCode: (isExecutingCode) => {
    set({
      isExecutingCode,
    });
  },
});
