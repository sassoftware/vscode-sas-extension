// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { authentication } from "vscode";
import { BaseConfig, RunResult, Session } from "..";
import { SASAuthProvider } from "../../components/AuthProvider";
import {
  getContextValue,
  setContextValue,
} from "../../components/ExtensionContext";
import { ContextsApi, LogLine, SessionsApi } from "./api/compute";
import { ComputeState, getApiConfig } from "./common";
import { ComputeJob } from "./job";
import { ComputeServer } from "./server";
import { ComputeSession } from "./session";

export interface Config extends BaseConfig {
  endpoint: string;
  clientId?: string;
  clientSecret?: string;
  context?: string;
  serverId?: string;
  reconnect?: boolean;
}

let config: Config;
let computeSession: ComputeSession | undefined;

async function reconnectComputeSession(): Promise<ComputeSession> {
  let session: ComputeSession = undefined;

  if (!config.reconnect) {
    return undefined;
  }

  //Grab the sessionId
  const sessionId: string = await getContextValue("SAS.sessionId");

  if (sessionId === undefined) {
    //No sessionId in the cache means nothing to reconnect to
    return undefined;
  }

  //At this point a sessionId was retrieved, so try and re-connect

  if (config.serverId) {
    const computeServer = new ComputeServer(config.serverId);

    try {
      session = await computeServer.getSession(sessionId);
    } catch (error) {
      console.log(
        `Attempt to reconnect to session ${sessionId} failed. A new session will be started`
      );
    }
  } else {
    const apiConfig = getApiConfig();
    const sessions = SessionsApi(apiConfig);

    try {
      const mySession = (await sessions.getSession({ sessionId: sessionId }))
        .data;
      session = ComputeSession.fromInterface(mySession);
    } catch (error) {
      console.log(
        `Attempt to reconnect to session ${sessionId} failed. A new session will be started`
      );
    }
  }

  if (session === undefined) {
    //If we tried to reconnect and failed, set the cached sessionId to undefined
    setContextValue("SAS.sessionId", undefined);
  }

  return session;
}

async function setup(): Promise<void> {
  const apiConfig = getApiConfig();
  let formattedOpts: string[] = [];
  const autoExecLines = config.autoExecLines || [];

  if (config.sasOptions) {
    formattedOpts = formatSASOptions();
  }

  if (!config.serverId) {
    const session = await authentication.getSession(SASAuthProvider.id, [], {
      createIfNone: true,
    });
    apiConfig.accessToken = session.accessToken;
  }

  if (computeSession && computeSession.sessionId) {
    const state = await computeSession
      .getState()
      .catch(() => (computeSession = undefined));
    if (state === ComputeState.Error) {
      await computeSession.cancel();
    } else if (computeSession !== undefined) {
      //This might look weird, but I dont know how to detect the session being in
      //syntax check mode right now so we need to send the cancel every time to make
      //sure the session is in a good state.
      await computeSession.cancel();
    }
  }

  if (computeSession) {
    return;
  }

  //Set the locale in the base options so it appears on all api calls
  const locale = JSON.parse(process.env.VSCODE_NLS_CONFIG ?? "{}").locale;
  apiConfig.baseOptions.headers = { "Accept-Language": locale };

  //Check to see if we can reconnect to a session first
  computeSession = await reconnectComputeSession();
  if (computeSession) {
    //reconnected to a running session, so just return
    return;
  }

  //Start a new session
  if (config.serverId) {
    const server1 = new ComputeServer(config.serverId);
    server1.options = formattedOpts;
    server1.autoExecLines = config.autoExecLines;
    computeSession = await server1.getSession();

    //Maybe wait for session to be initialized?
  } else {
    //Create session from context
    const contextsApi = ContextsApi(apiConfig);
    const contextName = config.context || "SAS Job Execution compute context";
    const context = (
      await contextsApi.getContexts({
        filter: `eq(name,'${contextName}')`,
      })
    ).data.items[0];
    if (!context?.id) {
      throw new Error("Compute Context not found: " + contextName);
    }

    const sess = (
      await contextsApi.createSession(
        {
          contextId: context.id,
          sessionRequest: {
            environment: {
              options: [...formattedOpts],
              autoExecLines: [...autoExecLines],
            },
          },
        },
        { headers: { "accept-language": locale } }
      )
    ).data;
    computeSession = ComputeSession.fromInterface(sess);
  }

  //Save the current sessionId
  setContextValue("SAS.sessionId", computeSession.sessionId);
}

/**
 * Formats the connection profile sasOptions into a format that the compute
 * API can understand.
 *
 * Examples:
 *
 * ```
 * ["-PAGESIZE=MAX"] -> ["-PAGESIZE MAX"]
 * ["-NOTERMINAL"] -> ["-NOTERMINAL"]
 * ```
 *
 * @returns formatted SAS Options
 */
function formatSASOptions() {
  const formattedOpts = config.sasOptions.map((opt) => {
    let formatted = opt;
    formatted = formatted.replace(/=/gi, " ");
    return formatted;
  });
  return formattedOpts;
}

async function cancel(): Promise<void> {
  if (computeSession) {
    await computeSession.self();
    await computeSession.cancel();
  }
}

/*
Prints the job log in an async manner.
*/
async function printLog(job: ComputeJob, onLog?: (logs: LogLine[]) => void) {
  const logs = await job.getLogStream();
  for await (const log of logs) {
    onLog(log);
  }
}

async function run(code: string, onLog?: (logs: LogLine[]) => void) {
  if (!computeSession?.sessionId) {
    throw new Error();
  }

  //Get the job
  const job = await computeSession.execute({ code: [code] });
  let state = await job.getState();

  const retLog = printLog(job, onLog);

  //Wait until the job is complete
  do {
    state = await job.getState({ onChange: true, wait: 2 });
  } while (await job.isDone(state));

  //Clear out the logs
  await retLog;

  //Now get the results
  const results = state === ComputeState.Error ? [] : await job.results();

  const res: RunResult = {
    html5: "",
    title: "",
  };

  /*
    We can return more than just html, but for right now we are only returning
    the last HTML file that we get.
    The last one is returned so that the one created from the vscode injected ods statement is
    always returned.
  */
  for (const result of results.reverse()) {
    const link = result.links[0];
    if (link?.type === "text/html") {
      const html5 = (await job.requestLink<string>(link)).data;

      //Make sure that the html has a valid body
      if (html5.search('<*id="IDX*.+">') !== -1) {
        res.html5 = html5;
        res.title = result.name;
      }

      break;
    }
  }

  return res;
}

function sessionId() {
  return computeSession && computeSession.sessionId;
}

async function close() {
  if (sessionId()) {
    computeSession.delete();
    computeSession = undefined;

    //Since the session is being closed, remove the cached session id
    setContextValue("SAS.sessionId", undefined);
  }
}

export function getSession(c: Config): Session {
  config = c;
  getApiConfig().basePath = config.endpoint + "/compute";

  return {
    setup,
    run,
    cancel,
    close,
    sessionId,
  };
}
