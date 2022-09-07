// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { initStore } from "@sassoftware/restaf";
import { computeRun, computeResults } from "@sassoftware/restaflib";
import { getAuthConfig } from "./auth";
import { DEFAULT_COMPUTE_CONTEXT, ProfileConfig } from "./profile";

let authConfig, profileConfig: ProfileConfig, computeSession;

let store = initStore();

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
async function computeSetup(contextName, payload) {
  if (payload !== null) {
    await store.logon(payload);
  }
  if (!contextName) {
    contextName = "SAS Job Execution compute context";
  }
  const { compute } = await store.addServices("compute");

  const contexts = await store.apiCall(compute.links("contexts"), {
    qs: { filter: `eq(name,'${contextName}')` },
  });
  if (contexts.details().get("count") === 0) {
    throw { Error: "Compute Context not found: " + contextName };
  }
  const createSession = contexts.itemsCmd(
    contexts.itemsList(0),
    "createSession"
  );
  const locale = JSON.parse(process.env.VSCODE_NLS_CONFIG ?? "").locale;
  const session = await store.apiCall(createSession, {
    headers: { "accept-language": locale },
  });
  return session;
}

export async function setup(): Promise<void> {
  if (!profileConfig) {
    profileConfig = new ProfileConfig();
  }
  // retrieve active & valid profile
  const activeProfile = await profileConfig.getActiveProfileDetail();
  const validProfile = await profileConfig.validateProfile(activeProfile);

  if (!authConfig) {
    authConfig = await getAuthConfig(validProfile);
  }
  if (computeSession) {
    const state = await store
      .apiCall(computeSession.links("state"))
      .catch(() => {
        computeSession = undefined;
      });
    if (state) {
      // Recover syntaxcheck mode
      await store
        .apiCall(computeSession.links("cancel"), {
          headers: {
            "if-Match": state.headers("etag"),
          },
        })
        .catch((err) => {
          console.log(JSON.stringify(err));
        });
    }
  }
  if (!computeSession) {
    computeSession = await computeSetup(
      validProfile.profile.context ?? DEFAULT_COMPUTE_CONTEXT,
      authConfig
    ).catch((err) => {
      authConfig = undefined;
      store = initStore();
      throw err;
    });
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

export function closeSession(): void {
  authConfig = undefined;
  if (computeSession)
    return store.apiCall(computeSession.links("delete")).finally(() => {
      store = initStore();
      computeSession = undefined;
    });
  store = initStore();
}
