import {
  BaseCompute,
  Compute,
  ComputeState,
  getApiConfig,
  stateOptions,
} from "./common";
import {
  SessionsApi,
  Session,
  SessionsApiGetSessionStateRequest,
  LogsApi,
  JobRequest,
  JobsApiAxiosParamCreator,
} from "./api/compute";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { ComputeJob } from "./job";

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
      throw new Error(`Error getting session with ID  ${id} - ${res.message}`);
    }
  }

  async self<Session>(): Promise<Session> {
    if (this._self.id === undefined)
      throw new Error("Cannot call self on ComputeSession with no id");

    const res = await this.api.getSession({ sessionId: this.sessionId });
    if (res.status === 200) {
      this._self = res.data;
      this.etag = res.headers["etag"];
      return res.data;
    } else {
      throw new Error(
        `Error getting server with ID  ${this._self.id} - ${res.message}`
      );
    }
  }

  async getState(options?: stateOptions): Promise<AxiosResponse<string>> {
    const parms: SessionsApiGetSessionStateRequest = {
      sessionId: this.sessionId,
      wait: options?.wait,
      ifNoneMatch: options?.onChange ? this.etag : undefined,
    };

    const resp = await this.api.getSessionState(parms);

    if (resp?.data) {
      this.etag = resp.headers["etag"];
      return resp.data;
    }

    throw new Error(`Failed to get state from Session ${this.sessionId}`);
  }

  async followLink<T>(
    linkName: string,
    options?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    if (this._self.links === undefined) await this.self();
    const link = this.getLink(this._self.links, linkName);
    if (link === undefined)
      throw new Error(`Session does not have '${linkName}' link`);

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
      { headers: { "Content-Type": "text/plain" } }
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
      this.etag = resp.headers["etag"];
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

  /**
   * Delete a session.
   *
   * This shuts down the SAS session.
   */
  async delete(): Promise<void> {
    await this.followLink("delete");
  }
}
