import { LogLine, RunResult, Session } from "..";
import * as grpc from "@grpc/grpc-js";
import { ExecutionServiceClient } from "./api/iom_broker_grpc_pb";
import {
  ConnectionContext,
  ExecutionRequest,
  FileChunk,
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
  return new Promise<void>((resolve, reject) => {
    if (client) {
      resolve();
    }

    client = new ExecutionServiceClient(
      `localhost:${config.port}`,
      grpc.credentials.createInsecure()
    );

    const connRequest = new ConnectionContext();
    connRequest.setHost("localhost");
    client.setupConnection(connRequest, (error, response) => {
      if (error) {
        reject(error);
      }
      console.log("setupConnection response: " + response.getRc());
      if (response.getRc() === 0) {
        resolve();
      }
    });
  });
};

const sessionId = (): string | undefined => {
  throw new Error("Method not implemented");
};

const run = async (
  code: string,
  onLog?: (logs: LogLine[]) => void
): Promise<RunResult> => {
  return new Promise<RunResult>((resolve, reject) => {
    const executionRequest = new ExecutionRequest();
    executionRequest.setCode(code);

    client.executeCode(executionRequest, (error, response) => {
      if (error) {
        reject(new Error(error.details));
      }

      console.log("executeCode response: " + response.getRc());

      if (response.getRc() === 0) {
        const logStream = client.fetchLog(new Empty());
        logStream.on("data", (chunk: LogChunk) => {
          const lines = chunk.getContent().split("\n");

          for (const line of lines) {
            onLog([{ line: line, type: "normal" }]);
          }
        });
        logStream.on("error", (error) => reject(error));

        const odsChunkSize = 32768;
        let odsBuffer = Buffer.alloc(odsChunkSize);

        const odsStream = client.fetchODS(new Empty());
        odsStream.on("data", (chunk: FileChunk) => {
          odsBuffer = Buffer.concat([odsBuffer, Buffer.from(chunk.getChunk())]);
        });
        odsStream.on("error", (error) => reject(error));
        odsStream.on("close", () => {
          const runResult: RunResult = {
            html5: odsBuffer.toString(),
            title: "Results",
          };
          resolve(runResult);
        });
      }
    });
  });
};

const close = async (): Promise<void> => {
  client.closeConnection(new Empty(), (error, response) => {
    if (error) {
      throw new Error(error.details);
    }
    console.log("close rc: " + response.getRc());
    client.close();
    client = undefined;
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
