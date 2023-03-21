// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { authentication } from "vscode";
import { RunResult, Session } from "..";
import { SASAuthProvider } from "../../components/AuthProvider";
import {
  getContextValue,
  setContextValue,
} from "../../components/ExtensionContext";
import { ContextsApi, LogLine } from "./api/compute";
import { ComputeState, getApiConfig } from "./common";
import { ComputeJob } from "./job";
import { ComputeServer } from "./server";
import { ComputeSession } from "./session";

export interface Config {
  endpoint: string;
  clientId?: string;
  clientSecret?: string;
  context?: string;
  serverId?: string;
  reconnect?: boolean;
}

let config: Config;
let computeSession: ComputeSession | undefined;

async function setup() {
  const apiConfig = getApiConfig();
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

  if (config.serverId) {
    const server1 = new ComputeServer(config.serverId);

    //if we have a session already, get it
    let sessionId: string = await getContextValue("SAS.sessionId");
    if (!config.reconnect) {
      sessionId = undefined;
    }
    if (sessionId !== undefined) {
      try {
        computeSession = await server1.getSession(sessionId);
        return;
      } catch (error) {
        console.log(
          `Attempt to reconnect to session ${sessionId} failed. Starting a new session`
        );
        setContextValue("SAS.sessionId", undefined);
      }
    }
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
        { contextId: context.id },
        { headers: { "accept-language": locale } }
      )
    ).data;
    computeSession = ComputeSession.fromInterface(sess);
  }

  //Save the current sessionId
  setContextValue("SAS.sessionId", computeSession.sessionId);
}

/*
Prints the job log in an async manner.
*/
async function printLog(job: ComputeJob, onLog?: (logs: LogLine[]) => void) {
  const log = await job.getLogStream();
  for await (const line of log) {
    onLog([line]);
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
  const results = await job.results();

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
    if (link.type === "text/html") {
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

async function close() {
  if (computeSession && computeSession.sessionId) {
    computeSession.delete();
    computeSession = undefined;
  }
}

export function getSession(c: Config): Session {
  config = { ...c };
  config.endpoint = config.endpoint.replace(/\/$/, "");
  getApiConfig().basePath = config.endpoint + "/compute";

  return {
    setup,
    run,
    close,
  };
}
