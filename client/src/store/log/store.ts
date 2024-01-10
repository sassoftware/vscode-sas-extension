import { subscribeWithSelector } from "zustand/middleware";
import { StateCreator, createStore } from "zustand/vanilla";

import { LogActions, createLogActions } from "./actions";
import { LogState, initialState } from "./initialState";

export type Store = LogState & LogActions;

const createdStore: StateCreator<Store, []> = (...parameters) => ({
  ...initialState,
  ...createLogActions(...parameters),
});

export const useStore = createStore<Store>()(
  subscribeWithSelector(createdStore),
);
