// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { BaseCompute, Compute, getApiConfig, stateOptions } from "./common";
import { ServersApi, Server, Link } from "./api/compute";
import { ComputeSession } from "./session";
import axios, { AxiosResponse } from "axios";

export class ComputeServer extends Compute {
  api;
  _self: Server & BaseCompute;

  constructor(id: string) {
    super();

    this._self = { id: id };

    this.api = ServersApi(getApiConfig());
  }

  get id(): string {
    return this._self?.id || "";
  }

  get links(): Array<Link> {
    return this._self?.links || [];
  }

  static fromInterface(server: Server): ComputeServer {
    const _server = new ComputeServer("");
    _server._self = server;
    return _server;
  }

  static fromResponse(response: AxiosResponse): ComputeServer {
    const _server = ComputeServer.fromInterface(response.data);
    _server.etag = response.headers.etag;
    return _server;
  }

  async self<Server>(): Promise<Server> {
    if (this._self.id === undefined) {
      throw new Error("Cannot call self on object with no id");
    }

    const res = await this.api.getServer({ serverId: this.id });
    if (res.status === 200) {
      this._self = res.data;
      this.etag = res.headers.etag;
      return res.data;
    } else {
      throw new Error(
        `Error getting server with ID  ${this.id} - ${res.message}`
      );
    }
  }

  async createSession(): Promise<ComputeSession> {
    if (this._self.links === undefined) {
      await this.self();
    }

    const link = this.getLink(this.links, "createSession");
    if (link === undefined) {
      throw new Error("Server does not have createSession link");
    }

    //Create the session
    //TODO: Add session create options
    //TODO: Session request should be an interface
    const body = {
      version: 1,
      name: "mysess",
      description: "This is a session",
      attributes: {},
      environment: {
        options: ["-validmemname EXTEND", "-validvarname ANY", "-memsize 0"],
        autoExecLines: [],
      },
    };

    let resp: AxiosResponse;
    try {
      resp = await this.requestLink(link, { data: body });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.message);
      }
    }

    //Create the session from the http resposne
    const session = ComputeSession.fromResponse(resp);
    return session;
  }

  async getSession(sessionId?: string): Promise<ComputeSession> {
    if (sessionId !== undefined) {
      return new ComputeSession(sessionId);
    } else {
      return this.createSession();
    }
  }

  async getState(options?: stateOptions): Promise<string> {
    if (this._self.links === undefined) {
      await this.self();
    }

    const params: { timeout?: number } = {};
    const headers = {};

    if (options !== undefined) {
      if (options.onChange) {
        headers["If-None-Match"] = this.etag;
      }

      if (options.wait) {
        params.timeout = options.wait;
      }
    }

    const link = this.getLink(this._self.links, "state");
    if (link === undefined) {
      throw new Error("Server does not have state link");
    }

    const { data, status } = await this.requestLink<string>(link, {
      params: params,
      headers: headers,
    });

    if (status === 200) {
      return data;
    } else {
      throw new Error("Something went wrong");
    }
  }
}
