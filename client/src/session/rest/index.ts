import { AxiosRequestConfig, AxiosResponse } from "axios";
import { Session } from "..";
import { createRequestFunction } from "./api/common";
import {
  ContextsApi,
  JobLogCollection,
  JobsApi,
  Link,
  LogLine,
  LogsApi,
  LogsApiGetJobLogRequest,
  ResultsApi,
  ServersApi,
  Session as ComputeSession,
  SessionsApi,
} from "./api/compute";
import { Configuration } from "./api/configuration";
import { clearTokens, getAccessToken } from "./auth";

export interface Config {
  endpoint: string;
  clientId?: string;
  clientSecret?: string;
  context?: string;
  serverId?: string;
}

const apiConfig = new Configuration();
let config: Config;
let computeSession: ComputeSession | undefined;

async function setup() {
  if (!config.serverId) {
    apiConfig.accessToken = await getAccessToken(config);
  }

  if (computeSession && computeSession.id) {
    const sessionsApi = SessionsApi(apiConfig);
    const state = await sessionsApi
      .getSessionState({ sessionId: computeSession.id })
      .catch(() => (computeSession = undefined));

    if (state?.data) {
      // Recover syntaxcheck mode
      await sessionsApi
        .updateSessionState(
          {
            sessionId: computeSession.id,
            value: "canceled",
            ifMatch: state.headers["etag"],
          },
          // has to override axios' default Content-Type
          { headers: { "Content-Type": "" } }
        )
        .catch((err) => console.dir(err));
    }
  }

  if (computeSession) return;

  const locale = JSON.parse(process.env.VSCODE_NLS_CONFIG ?? "{}").locale;

  if (config.serverId) {
    // PuP
    const serverApi = ServersApi(apiConfig);
    const server = (await serverApi.getServer({ serverId: config.serverId }))
      .data;
    const link = server.links.find(
      (l) => l.rel.toLowerCase() === "createsession"
    );
    if (link) {
      computeSession = (
        await requestLink(link, {
          method: link.method,
          headers: { "accept-language": locale },
        })
      ).data;
    }
    return;
  }

  const contextsApi = ContextsApi(apiConfig);
  const contextName = config.context || "SAS Job Execution compute context";
  const context = (
    await contextsApi.getContexts({
      filter: `eq(name,'${contextName}')`,
    })
  ).data.items[0];
  if (!context?.id)
    throw new Error("Compute Context not found: " + contextName);

  computeSession = (
    await contextsApi.createSession(
      { contextId: context.id },
      { headers: { "accept-language": locale } }
    )
  ).data;
}

async function run(code: string, onLog?: (logs: LogLine[]) => void) {
  if (!computeSession?.id) throw new Error();

  const jobsApi = JobsApi(apiConfig);

  const resultsApi = ResultsApi(apiConfig);

  const job = (
    await jobsApi.createJob({
      sessionId: computeSession.id,
      jobRequest: { code: [code] },
    })
  ).data;
  if (!job.id) throw new Error();

  const state = await jobsApi.getJobState({
    sessionId: computeSession.id,
    jobId: job.id,
  });
  let logOffset = 0;
  if (state.data === "running" || state.data === "pending") {
    await getLogs({ sessionId: computeSession.id, jobId: job.id }, (logs) => {
      logOffset += logs.length;
      onLog?.(logs);
    });
    await jobsApi
      .getJobState({
        sessionId: computeSession.id,
        jobId: job.id,
        wait: 60,
        ifNoneMatch: state.headers["etag"],
      })
      .catch((err) => {
        if (err.response?.status === 304) {
          throw new Error("Job did not complete in 60 seconds.");
        }
        throw err;
      });
  }

  getLogs(
    { sessionId: computeSession.id, jobId: job.id, start: logOffset },
    onLog
  );

  const result = (
    await resultsApi.getJobResults({
      sessionId: computeSession.id,
      jobId: job.id,
    })
  ).data.items.find((result) => result.type === "ODS");

  const html5 = result?.links?.[0].href
    ? (await requestLink<string>(result.links[0])).data
    : "";

  return {
    html5,
  };
}

async function getLogs(
  requestParameters: LogsApiGetJobLogRequest,
  onLog?: (logs: LogLine[]) => void
) {
  const logsApi = LogsApi(apiConfig);
  let logCollection = (await logsApi.getJobLog(requestParameters)).data;
  let logs = logCollection.items;
  if (logs.length) {
    onLog?.(logs);
  }
  let nextLink = logCollection.links?.find((link) => link.rel === "next");
  while (nextLink) {
    logCollection = (await requestLink<JobLogCollection>(nextLink)).data;
    logs = logCollection.items;
    if (logs.length) {
      onLog?.(logs);
    }
    nextLink = logCollection.links?.find((link) => link.rel === "next");
  }
}

async function requestLink<T>(
  link: Link,
  options?: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  if (!link.href) throw new Error();
  return createRequestFunction<T>(
    {
      url: link.href.slice("/compute".length),
      options: options ?? { headers: {} },
    },
    apiConfig
  );
}

async function close() {
  clearTokens();
  if (computeSession && computeSession.id) {
    const sessionsApi = SessionsApi(apiConfig);
    await sessionsApi
      .deleteSession({ sessionId: computeSession.id })
      .finally(() => (computeSession = undefined));
  }
}

export function getSession(c: Config): Session {
  config = c;
  config.endpoint = config.endpoint.replace(/\/$/, "");
  apiConfig.basePath = config.endpoint + "/compute";

  return {
    setup,
    run,
    close,
  };
}
