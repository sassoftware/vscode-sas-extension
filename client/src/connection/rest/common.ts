import * as typer from "media-typer";
import { Link } from "./api/compute";
import { Configuration } from "./api/configuration";

import { AxiosRequestConfig, AxiosResponse } from "axios";
import { createRequestFunction, RequestArgs } from "./api/common";

/**
 * States that can be on a Job or Session
 */
export enum ComputeState {
  Error = "error",
  Canceled = "canceled",
  Done = "done",
  Warning = "warning",
  Completed = "completed",
  Running = "running",
  Pending = "pending",
  Idle = "idle",
}

export interface stateOptions {
  onChange?: boolean;
  wait?: number;
}

export interface BaseCompute {
  links?: Array<Link>;
}

//global api config
const apiConfig = new Configuration({ baseOptions: {} });

export function getApiConfig(): Configuration {
  return apiConfig;
}

export function computeMediaType(type: string): string {
  const parsed = typer.parse(type);
  if (
    parsed.type === "application" &&
    parsed.subtype?.startsWith("vnd.sas") &&
    parsed.suffix === undefined
  ) {
    parsed.suffix = "json";
    return typer.format(parsed);
  }
  return type;
}

/**
 * Base class for compute like objects
 */
export class Compute {
  etag: string;

  async self<T>(): Promise<T> {
    throw new Error("Not implemented");
  }

  //Shortcut function to get a link by its name
  getLink(links: Array<Link>, rel: string): Link | undefined {
    return links.find((link: Link) => link.rel === rel);
  }

  /*
  Get the options for a link
  This sets the URL, accept/content-type headers as well as the Method and 
  etag headers if needed
  */
  getLinkOptions(link: Link, options?: AxiosRequestConfig): RequestArgs {
    if (options === undefined) {
      options = {};
    }
    const headers = { ...options?.headers };

    if (link.method === "POST") {
      if (link.type !== undefined) {
        headers["Content-Type"] = computeMediaType(link.type);
      }
      if (link.responseType !== undefined) {
        headers.Accept = computeMediaType(link.responseType);
      }
    } else if (link.method === "PUT") {
      if (link.type !== undefined) {
        headers["Content-Type"] = computeMediaType(link.type);
      }
      if (link.responseType !== undefined) {
        headers.Accept = computeMediaType(link.responseType);
      }
      if (this.etag !== undefined) {
        headers["If-Match"] = this.etag;
      }
    } else if (link.method === "DELETE") {
      if (this.etag !== undefined) {
        headers["If-Match"] = this.etag;
      }
    } else if (link.type !== undefined) {
      headers.Accept = computeMediaType(link.type);
    }

    //The link must have an href
    if (!link.href) {
      throw new Error();
    }

    //Take the optional options given and merge in the link options
    Object.assign(options, {
      headers: headers,
      method: link.method,
      url: link.href,
    });

    //TODO: We should not have to remove the /compute from the link
    return { url: link.href.slice("/compute".length), options: options };
  }

  /*
  Make a request via a link
  */
  async requestLink<T>(
    link: Link,
    options?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    if (options === undefined) {
      options = {};
    }
    const apiConfig = getApiConfig();
    Object.assign(options, {
      headers: apiConfig.baseOptions?.headers,
    });
    const o = this.getLinkOptions(link, options);

    return createRequestFunction<T>(o, getApiConfig());
  }
}
