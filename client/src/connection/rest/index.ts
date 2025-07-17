// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { authentication, l10n } from "vscode";

import { BaseConfig, RunResult } from "..";
import { SASAuthProvider } from "../../components/AuthProvider";
import {
  getContextValue,
  setContextValue,
} from "../../components/ExtensionContext";
import { updateStatusBarItem } from "../../components/StatusBarItem";
import { Session, SessionContextAttributes } from "../session";
import { Context, ContextsApi, SessionsApi } from "./api/compute";
import { ComputeState, getApiConfig } from "./common";
import { ComputeJob } from "./job";
import { ComputeServer } from "./server";
import { ComputeSession } from "./session";

let sessionInstance: RestSession;

export interface Config extends BaseConfig {
  endpoint: string;
  clientId?: string;
  clientSecret?: string;
  context?: string;
  serverId?: string;
  reconnect?: boolean;
}

class RestSession extends Session {
  private _config: Config;
  private _computeSession: ComputeSession | undefined;

  constructor() {
    super();
  }

  public set config(value: Config) {
    this._config = value;
  }

  public async contextAttributes(): Promise<SessionContextAttributes> {
    const context = await this.getContext();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return context.attributes as SessionContextAttributes;
  }

  public async getContext() {
    const contextsApi = ContextsApi(getApiConfig());
    const contextName =
      this._config.context || "SAS Job Execution compute context";
    const context = (
      await contextsApi.getContexts({
        filter: `eq(name,'${contextName}')`,
      })
    ).data.items[0];
    if (!context?.id) {
      throw new Error(
        l10n.t("Compute Context not found: {name}", { name: contextName }),
      );
    }

    // Lets use the id to get context details
    const contextResponse = await contextsApi.getContext({
      contextId: context.id,
    });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return contextResponse.data || (context as Context);
  }

  protected establishConnection = async (): Promise<void> => {
    const apiConfig = getApiConfig();
    let formattedOpts: string[] = [];
    const autoExecLines = this._config.autoExecLines || [];

    if (this._config.sasOptions) {
      formattedOpts = this.formatSASOptions();
    }

    if (!this._config.serverId) {
      const session = await authentication.getSession(SASAuthProvider.id, [], {
        createIfNone: true,
      });
      apiConfig.accessToken = session.accessToken;
    }

    if (this._computeSession && this._computeSession.sessionId) {
      const state = await this._computeSession
        .getState()
        .catch(() => (this._computeSession = undefined));
      if (state === ComputeState.Error) {
        await this._computeSession.cancel();
      } else if (this._computeSession !== undefined) {
        //This might look weird, but I dont know how to detect the session being in
        //syntax check mode right now so we need to send the cancel every time to make
        //sure the session is in a good state.
        await this._computeSession.cancel();
      }
    }

    if (this._computeSession) {
      return;
    }

    //Set the locale in the base options so it appears on all api calls
    let locale = JSON.parse(process.env.VSCODE_NLS_CONFIG ?? "{}").locale;
    if (locale === "qps-ploc") {
      // VS Code's pseudo locale, not supported in Viya server
      locale = "en";
    }
    apiConfig.baseOptions.headers = { "Accept-Language": locale };

    //Check to see if we can reconnect to a session first
    this._computeSession = await this.reconnectComputeSession();
    if (this._computeSession) {
      //reconnected to a running session, so just return
      await this.printSessionLog(this._computeSession);
      updateStatusBarItem(true);
      return;
    }

    //Start a new session
    if (this._config.serverId) {
      const server1 = new ComputeServer(this._config.serverId);
      server1.options = formattedOpts;
      server1.autoExecLines = this._config.autoExecLines;
      this._computeSession = await server1.getSession();

      //Maybe wait for session to be initialized?
    } else {
      const contextsApi = ContextsApi(apiConfig);
      const context = await this.getContext();

      //Create session from context
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
          { headers: { "accept-language": locale } },
        )
      ).data;
      this._computeSession = ComputeSession.fromInterface(sess);
    }

    await this.printSessionLog(this._computeSession);

    //Save the current sessionId
    setContextValue("SAS.sessionId", this._computeSession.sessionId);
    updateStatusBarItem(true);
  };

  protected _run = async (code: string) => {
    if (!this._computeSession?.sessionId) {
      throw new Error();
    }
    //Get the job
    const job = await this._computeSession.execute({ code: [code] });

    //Clear out the logs
    await this.printJobLog(job);
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
  };

  protected _close = async () => {
    if (this.sessionId()) {
      this._computeSession.delete();
      this._computeSession = undefined;

      //Since the session is being closed, remove the cached session id
      setContextValue("SAS.sessionId", undefined);
      updateStatusBarItem(false);
    }
  };

  public sessionId = (): string => {
    return this._computeSession && this._computeSession.sessionId;
  };

  public cancel = async (): Promise<void> => {
    if (this._computeSession) {
      await this._computeSession.self();
      await this._computeSession.cancel();
    }
  };

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
  private formatSASOptions = (): string[] => {
    const formattedOpts = this._config.sasOptions.map((opt) => {
      let formatted = opt;
      formatted = formatted.replace(/=/gi, " ");
      return formatted;
    });
    return formattedOpts;
  };

  private reconnectComputeSession = async (): Promise<ComputeSession> => {
    let session: ComputeSession = undefined;

    if (!this._config.reconnect) {
      return undefined;
    }

    //Grab the sessionId
    const sessionId: string = await getContextValue("SAS.sessionId");

    if (sessionId === undefined) {
      //No sessionId in the cache means nothing to reconnect to
      return undefined;
    }

    //At this point a sessionId was retrieved, so try and re-connect

    if (this._config.serverId) {
      const computeServer = new ComputeServer(this._config.serverId);

      try {
        session = await computeServer.getSession(sessionId);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        console.log(
          `Attempt to reconnect to session ${sessionId} failed. A new session will be started`,
        );
      }
    } else {
      const apiConfig = getApiConfig();
      const sessions = SessionsApi(apiConfig);

      try {
        const mySession = (await sessions.getSession({ sessionId: sessionId }))
          .data;
        session = ComputeSession.fromInterface(mySession);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        console.log(
          `Attempt to reconnect to session ${sessionId} failed. A new session will be started`,
        );
      }
    }

    if (session === undefined) {
      //If we tried to reconnect and failed, set the cached sessionId to undefined
      setContextValue("SAS.sessionId", undefined);
    }

    return session;
  };

  /**
   * Prints the job log in an async manner.
   * @param job a job id to print logs for.
   */
  private printJobLog = async (job: ComputeJob) => {
    const logs = job.getLogStream();
    for await (const log of logs) {
      if (log?.length > 0) {
        this._onExecutionLogFn(log);
      }
    }
  };

  /**
   * Prints the session log in an async manner.
   * @param session a session id to print logs for.
   */
  private printSessionLog = async (session: ComputeSession) => {
    const logs = await session.getLogStream();
    for await (const log of logs) {
      if (log?.length > 0 && this._onSessionLogFn) {
        this._onSessionLogFn(log);
      }
    }
  };
}

export function getSession(c: Config): Session {
  getApiConfig().basePath = c.endpoint + "/compute";

  if (!sessionInstance) {
    sessionInstance = new RestSession();
  }
  sessionInstance.config = c;

  return sessionInstance;
}
