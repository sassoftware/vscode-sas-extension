// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Middleware that will log state changes to the console. Useful for debugging purposes.
 * @param config
 */
export const logger = (config) => (set, get, api) => {
  return config(
    (args) => {
      const newState = typeof args === "function" ? args(get()) : args;
      console.info(`State changed:`, newState);
      set(newState);
    },
    get,
    api,
  );
};
