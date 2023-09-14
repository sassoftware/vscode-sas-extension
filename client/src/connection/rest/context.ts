// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import axios, { AxiosResponse } from "axios";
import { l10n } from "vscode";

import { Context, ContextSummary, ContextsApi, Link } from "./api/compute";
import { BaseCompute, Compute, getApiConfig } from "./common";
import { ComputeSession } from "./session";

export class ComputeContext extends Compute {
  api;
  _self: Context | (ContextSummary & BaseCompute);

  constructor(id: string, name: string, launchType: string) {
    super();

    this._self = { id, name, launchType, launchContext: {} };

    this.api = ContextsApi(getApiConfig());
  }

  static fromInterface(context: Context | ContextSummary): ComputeContext {
    const ctx = new ComputeContext("", "", "");
    ctx._self = context;
    return ctx;
  }

  static fromResponse(response: AxiosResponse): ComputeContext {
    const ctx = ComputeContext.fromInterface(response.data);
    ctx.etag = response.headers.etag;
    return ctx;
  }

  static async getContextByName(name: string): Promise<ComputeContext> {
    const contextsApi = ContextsApi(getApiConfig());
    const context = (
      await contextsApi.getContexts({
        filter: `eq(name,'${name}')`,
      })
    ).data.items[0];
    if (!context?.id) {
      throw new Error(l10n.t("Compute Context not found: {name}", { name }));
    }

    return ComputeContext.fromInterface(context);
  }

  get id(): string {
    return this._self?.id || "";
  }

  get links(): Array<Link> {
    return this._self?.links || [];
  }

  async self<Context>(): Promise<Context> {
    if (this._self.id === undefined) {
      throw new Error(l10n.t("Cannot call self on object with no id"));
    }

    throw new Error(l10n.t("Not implemented"));
  }

  async createSession(): Promise<ComputeSession> {
    if (this._self.links === undefined) {
      await this.self();
    }

    const link = this.getLink(this.links, "createSession");
    if (link === undefined) {
      throw new Error(l10n.t("Server does not have createSession link"));
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

    const options = this.getLinkOptions(link, { data: body });

    let resp: AxiosResponse;
    try {
      resp = await this.requestLink(link, options);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.message);
      }
    }

    //Create the session from the http resposne
    return ComputeSession.fromResponse(resp);
  }
}
