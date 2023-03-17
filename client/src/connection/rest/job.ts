// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { Compute, getApiConfig, stateOptions } from "./common";
import {
  LogsApi,
  JobsApi,
  JobsApiGetJobStateRequest,
  Job,
  Result,
  ResultCollection,
  LogLine,
  Link,
} from "./api/compute";
import { AxiosRequestConfig, AxiosResponse } from "axios";

export class ComputeJob extends Compute {
  api;
  logs;
  _self: Job;

  constructor(id: string) {
    super();

    //set the id
    this._self = { id: id };

    //Get the apis I need
    this.api = JobsApi(getApiConfig());
    this.logs = LogsApi(getApiConfig());
  }

  get id(): string {
    return this._self?.id || "";
  }

  static fromInterface(job: Job): ComputeJob {
    const obj = new ComputeJob("");
    obj._self = job;
    return obj;
  }

  static fromResponse(response: AxiosResponse): ComputeJob {
    const obj = ComputeJob.fromInterface(response.data);
    obj.etag = response.headers.etag;
    return obj;
  }

  async followLink<T>(
    linkName: string,
    options?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    if (this._self.links === undefined) {
      await this.self();
    }
    const link = this.getLink(this._self.links, linkName);
    if (link === undefined) {
      throw new Error(`Job does not have '${linkName}' link`);
    }

    return await this.requestLink(link, options);
  }

  async getState(options?: stateOptions): Promise<string> {
    const parms: JobsApiGetJobStateRequest = {
      sessionId: this._self.sessionId,
      jobId: this.id,
      wait: options?.wait,
      ifNoneMatch: options?.onChange ? this.etag : undefined,
    };

    const resp = await this.api.getJobState(parms, {
      validateStatus: (status) => {
        return status >= 200 && status < 400;
      },
    });
    if (resp.status === 200) {
      //Set the new etag
      this.etag = resp.headers.etag;

      //return the state
      return resp.data;
    } else if (resp.status === 304) {
      //Not modified
      return await this.getState(); //This is bad. We need to cache the last state value
    } else {
      throw new Error("Something went wrong");
    }
  }

  //Get the job log as a stream.
  async *getLogStream(options?: { timeout?: number }): AsyncGenerator<LogLine> {
    let state = await this.getState();
    const timeout = options?.timeout ?? 10;
    let start = 0;

    const states = ["done", "canceled", "error", "warning", "completed"];

    while (states.indexOf(state) === -1) {
      //Get a log page
      const resp = await this.logs.getJobLog({
        sessionId: this._self.sessionId,
        jobId: this.id,
        start: start,
        timeout: timeout,
      });

      if (resp.status === 200) {
        const items = resp.data.items;
        const num = items.length;
        for (let i = 0; i < num; i++) {
          yield items[i];
        }

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
    let resp = await this.logs.getJobLog({
      sessionId: this._self.sessionId,
      jobId: this.id,
      start: start,
      timeout: timeout,
    });

    //To clear out the log, we yeild all lines until there is not "next" link
    do {
      if (resp.status === 200) {
        nextLink = resp.links?.find((link) => link.rel === "next");
        const items = resp.data.items;
        const num = items.length;
        for (let i = 0; i < num; i++) {
          yield items[i];
        }

        if (nextLink) {
          resp = await this.requestLink(nextLink);
        }
      } else {
        break;
      }
    } while (nextLink !== undefined);
  }

  /*
  Check to see if the job is done.
  Done is defined as the job having run to some sort of completed state
  ie. the job stopped because it finished executing or is was stopped 
  due to an error or other signal.
  */
  async isDone(state?: string): Promise<boolean> {
    const doneStates = ["done", "canceled", "error", "warning", "completed"];

    return doneStates.indexOf(state || (await this.getState())) === -1;
  }

  /*
  Return job results
  */
  async results(type?: string): Promise<Result[]> {
    const resp = await this.followLink<ResultCollection>("results");

    if (type) {
      return [resp.data.items.reverse().find((result) => result.type === type)];
    }
    return resp.data.items;
  }
}
