// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { StateCreator } from "zustand/vanilla";

import type { Store } from "./store";

export interface LogActions {
  /**
   * Resets producedExecutionOutput to its default value.
   */
  setProducedExecutionLogOutput: (boolean) => void;
}

export const createLogActions: StateCreator<Store, [], [], LogActions> = (
  set,
) => ({
  setProducedExecutionLogOutput: (producedExecutionOutput: boolean) =>
    set({ producedExecutionOutput }),
});
