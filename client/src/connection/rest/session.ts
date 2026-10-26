// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

import { AxiosRequestConfig, AxiosResponse } from "axios";

import type { OnLogFn } from "..";
import {
  JobLogCollection,
  JobRequest,
  JobsApiAxiosParamCreator,
  Link,
  LogLine,
  LogsApi,
  Session,
  SessionsApi,
  SessionsApiGetSessionStateRequest,
} from "./api/compute";
import {
  BaseCompute,
  Compute,
  ComputeState,
  getApiConfig,
  stateOptions,
} from "./common";
import { ComputeJob } from "./job";

export const DEBUGGER_SAMPLE_CODE = `options dsoptions=ldebug notes source;

data _null_;
    /* Test */
    a=(1 + 2) + 3;
    b=1 + (2 + 3);

    c=(0.1 + 0.2) + 0.3;
    d=0.1 + (0.2 + 0.3);

    e=0.6;
    f=0.6;

    r1=cats("a=", a);
    r2=cats("b=", b);

    r3=cats("c=", c);
    r4=cats("d=", d);
    r5=cats("e=", e);
    r6=cats("f=", f);

    /* case 1 */
    c1="false";
    if a eq b then do;
        c1="true";
    end;

    /* case 2 */
    c2="false";
    if c eq d then do;
        c2="true";
    end;

    /* case 3 */
    c3="false";
    if e eq f then do;
        c3="true";
    end;

    put "RESULTS";
    put c1;
    put c2;
    put c3;
run;

describe _all_;`;

export class ComputeSession extends Compute {
  api; //Session api
  logs; //Logs api
  _self: Session & BaseCompute;

  constructor(id: string) {
    super();

    //Set at least Id in self.
    this._self = { id: id };

    //Get the api objects we need
    this.api = SessionsApi(getApiConfig());
    this.logs = LogsApi(getApiConfig());
  }

  get sessionId(): string {
    return this._self?.id || "";
  }

  static fromInterface(session: Session): ComputeSession {
    const sess = new ComputeSession("");
    sess._self = session;
    return sess;
  }

  static fromResponse(response: AxiosResponse): ComputeSession {
    const sess = ComputeSession.fromInterface(response.data);
    sess.etag = response.headers.etag;
    return sess;
  }

  async getSession(sessionId?: string): Promise<Session> {
    const id = sessionId || this.sessionId;
    const res = await this.api.getSession({ sessionId: id });
    if (res.status === 200) {
      return res.data;
    } else {
      throw new Error(
        l10n.t("Error getting session with ID {id} - {message}", {
          id,
          message: res.message,
        }),
      );
    }
  }

  async self<Session>(): Promise<Session> {
    if (this._self.id === undefined) {
      throw new Error(l10n.t("Cannot call self on ComputeSession with no id"));
    }

    const res = await this.api.getSession({ sessionId: this.sessionId });
    if (res.status === 200) {
      this._self = res.data;
      this.etag = res.headers.etag;
      return res.data;
    } else {
      throw new Error(
        l10n.t("Error getting server with ID {id} - {message}", {
          id: this._self.id,
          message: res.message,
        }),
      );
    }
  }

  async getState(options?: stateOptions): Promise<string> {
    const parms: SessionsApiGetSessionStateRequest = {
      sessionId: this.sessionId,
      wait: options?.wait,
      ifNoneMatch: options?.onChange ? this.etag : undefined,
    };

    const resp = await this.api.getSessionState(parms);

    if (resp?.data) {
      this.etag = resp.headers.etag;
      return resp.data;
    }

    throw new Error(
      l10n.t("Failed to get state from Session {sessionId}", {
        sessionId: this.sessionId,
      }),
    );
  }

  async followLink<T>(
    linkName: string,
    options?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    if (this._self.links === undefined) {
      await this.self();
    }
    const link = this.getLink(this._self.links, linkName);
    if (link === undefined) {
      throw new Error(
        l10n.t("Session does not have '{linkName}' link", { linkName }),
      );
    }

    return await this.requestLink(link, options);
  }

  /**
   * Set the state of a session.
   * Not all states may be set on a session.
   *
   * @param state
   */
  async setState(state: ComputeState): Promise<AxiosResponse<void>> {
    return this.api.updateSessionState(
      {
        sessionId: this.sessionId,
        value: state,
        ifMatch: this.etag,
      },
      { headers: { "Content-Type": "text/plain" } },
    );
  }

  /**
   * Cancel a session.
   * This is used to recover from syntax check mode.
   * @returns
   */
  async cancel(): Promise<boolean> {
    const resp = await this.setState(ComputeState.Canceled);

    if (resp.status === 200) {
      this.etag = resp.headers.etag;
      return true;
    } else if (resp.status === 412) {
      await this.self();
      return await this.cancel();
    }
    return false;
  }

  /**
   * Execute code in the SAS session
   * @param request
   * @returns
   */
  async execute(request: JobRequest): Promise<ComputeJob> {
    const paramCreator = JobsApiAxiosParamCreator(getApiConfig());
    const options = (await paramCreator.createJob(this.sessionId, request))
      .options;

    //Submit the job.
    //This does not wait for the job to complete, just to return the definition
    const resp = await this.followLink("execute", options);

    //Now create the job object
    return ComputeJob.fromResponse(resp);
  }

  async executeDebuggerCode(code: string, onLog: OnLogFn): Promise<string> {
    return this.executeAndWait(
      [
        "options dsoptions=ldebug notes source;",
        ...code.split(/\r?\n/),
        "describe _all_;",
      ],
      onLog,
    );
  }

  /**
   * Run code and resolve with the job ID once the job has finished.
   */
  private async executeAndWait(
    code: string[],
    onLog: OnLogFn,
  ): Promise<string> {
    const job = await this.execute({ code });

    let state = await job.getState();
    while (!(await job.isDone(state))) {
      state = await job.getState({ wait: 5, onChange: true });
    }

    let response = await job.logs.getJobLog({
      sessionId: this.sessionId,
      jobId: job.id,
      start: 0,
    });
    while (true) {
      onLog(response.data.items);
      const nextLink = response.data.links?.find((link) => link.rel === "next");
      if (!nextLink) {
        break;
      }
      response = await job.requestLink<JobLogCollection>(nextLink);
    }

    return job.id;
  }

  /**
   * Delete a session.
   *
   * This shuts down the SAS session.
   */
  async delete(): Promise<void> {
    await this.followLink("delete");
  }

  async *getLogStream(options?: {
    timeout?: number;
  }): AsyncGenerator<LogLine[]> {
    let state = await this.getState();
    const timeout = options?.timeout ?? 10;
    let start = 0;

    const states = [
      "done",
      "canceled",
      "error",
      "warning",
      "completed",
      "idle",
      "failed",
    ];

    while (states.indexOf(state) === -1) {
      //Get a log page
      const resp = await this.logs.getSessionLog({
        sessionId: this.sessionId,
        start: start,
        timeout: timeout,
      });

      if (resp.status === 200) {
        const items = resp.data.items;
        const num = items.length;

        yield items;

        //increase start location
        start += num;

        //get new state
        state = await this.getState();
      } else {
        break;
      }
    }

    //There is a chance that the job ended between our last read and now.
    //Need to make sure we clear out the log

    let nextLink: Link = undefined;
    let resp = await this.logs.getSessionLog({
      sessionId: this.sessionId,
      start: start,
    });

    //To clear out the log, we yeild all lines until there is not "next" link
    do {
      if (resp.status === 200) {
        nextLink = resp.data.links?.find((link) => link.rel === "next");
        const items = resp.data.items;
        yield items;

        if (nextLink) {
          resp = await this.requestLink(nextLink);
        }
      } else {
        break;
      }
    } while (nextLink !== undefined);
  }
}
