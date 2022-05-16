// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { initStore } from "@sassoftware/restaf";
import {
  //computeSetup,
  computeRun,
  computeResults,
} from "@sassoftware/restaflib";
import { getAuthConfig } from "./auth";

const store = initStore();

let authConfig, computeSession;

export interface LogLine {
  type: string;
  line: string;
}

export interface Results {
  log: LogLine[];
  ods: string;
}

// copied from restaflib
// inject VSCode locale when create session
async function computeSetup(store, contextName, payload) {
  if (payload !== null) {
    await store.logon(payload);
  }
  const { compute } = await store.addServices("compute");
  const contexts = await store.apiCall(compute.links("contexts"));
  if (contextName === null) {
    contextName = "Job Execution compute";
  }
  contextName = contextName.toLowerCase();
  const index = contexts
    .itemsList()
    .findIndex((c) => c.toLowerCase().indexOf(contextName) >= 0);
  if (index === -1) {
    throw { Error: "Compute Context not found: " + contextName };
  }
  const createSession = contexts.itemsCmd(
    contexts.itemsList(index),
    "createSession"
  );
  const locale = JSON.parse(process.env.VSCODE_NLS_CONFIG).locale;
  const session = await store.apiCall(createSession, {
    headers: { "accept-language": locale },
  });
  return session;
}

export async function setup(): Promise<void> {
  if (!authConfig) {
    authConfig = await getAuthConfig();
  }
  if (computeSession) {
    await store.apiCall(computeSession.links("state")).catch(() => {
      computeSession = undefined;
    });
  }
  if (!computeSession) {
    computeSession = await computeSetup(store, null, authConfig).catch(
      (err) => {
        authConfig = undefined;
        store.logoff();
        throw err;
      }
    );
  }
}

export async function run(code: string): Promise<Results> {
  const computeSummary = await computeRun(store, computeSession, code);

  const log = await computeResults(store, computeSummary, "log");
  const ods = await computeResults(store, computeSummary, "ods");
  return {
    log,
    ods,
  };
}

export function closeSession(): Promise<void> {
  authConfig = undefined;
  if (computeSession)
    return store.apiCall(computeSession.links("delete")).finally(() => {
      store.logoff();
      computeSession = undefined;
    });
  store.logoff();
}
