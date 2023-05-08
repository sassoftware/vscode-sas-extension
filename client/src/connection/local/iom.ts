import { LogLine, RunResult, Session } from "..";
import * as grpc from "@grpc/grpc-js";
import { ExecutionServiceClient } from "./api/iom_broker_grpc_pb";
import {
  ConnectionContext,
  ExecutionRequest,
  LogChunk,
} from "./api/iom_broker_pb";
import { Empty } from "google-protobuf/google/protobuf/empty_pb";

let client: ExecutionServiceClient;
let config: Config;

export interface Config {
  sasOptions: string[];
  port: number;
}

const setup = async (): Promise<void> => {
  if (!client) {
    client = new ExecutionServiceClient(
      `localhost:${config.port}`,
      grpc.credentials.createInsecure()
    );
  }

  const connRequest = new ConnectionContext();
  connRequest.setHost("localhost");
  client.setupConnection(connRequest, (error, response) => {
    if (error) {
      throw error;
    }
    console.log("setupConnection response: " + response.getRc());
  });
};

const sessionId = (): string | undefined => {
  throw new Error("Method not implemented");
};

const run = async (
  code: string,
  onLog?: (logs: LogLine[]) => void
): Promise<RunResult> => {
  const executionRequest = new ExecutionRequest();
  executionRequest.setCode(code);

  client.executeCode(executionRequest, (error, response) => {
    if (error) {
      throw error;
    }

    console.log("executeCode response: " + response.getRc());

    const logStream = client.fetchLog(new Empty());
    logStream.on("data", (chunk: LogChunk) => {
      const lines = chunk.getContent().split("\n");

      for (const line of lines) {
        let logline: LogLine;
        logline.type = line.startsWith("ERROR") ? "error" : "normal";
        logline.line = line;
        onLog([logline]);
      }
    });
    logStream.on("error", Promise.reject);
  });
  const runResult = {};
  return runResult;
};

const close = async (): Promise<void> => {
  client.closeConnection(new Empty(), (error, response) => {
    if (error) {
      throw error;
    }
    console.log("close rc: " + response.getRc());
  });
};

export const getSession = (c: Config): Session => {
  config = c;
  return {
    setup,
    run,
    close,
    sessionId,
  };
};
