// package: iomBroker
// file: iom_broker.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as iom_broker_pb from "./iom_broker_pb";
import * as google_protobuf_empty_pb from "google-protobuf/google/protobuf/empty_pb";

interface IExecutionServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    setupConnection: IExecutionServiceService_ISetupConnection;
    executeCode: IExecutionServiceService_IExecuteCode;
    closeConnection: IExecutionServiceService_ICloseConnection;
    fetchLog: IExecutionServiceService_IFetchLog;
}

interface IExecutionServiceService_ISetupConnection extends grpc.MethodDefinition<iom_broker_pb.ConnectionContext, iom_broker_pb.SetupConnectionResponse> {
    path: "/iomBroker.ExecutionService/SetupConnection";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<iom_broker_pb.ConnectionContext>;
    requestDeserialize: grpc.deserialize<iom_broker_pb.ConnectionContext>;
    responseSerialize: grpc.serialize<iom_broker_pb.SetupConnectionResponse>;
    responseDeserialize: grpc.deserialize<iom_broker_pb.SetupConnectionResponse>;
}
interface IExecutionServiceService_IExecuteCode extends grpc.MethodDefinition<iom_broker_pb.ExecutionRequest, iom_broker_pb.ExecutionResponse> {
    path: "/iomBroker.ExecutionService/ExecuteCode";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<iom_broker_pb.ExecutionRequest>;
    requestDeserialize: grpc.deserialize<iom_broker_pb.ExecutionRequest>;
    responseSerialize: grpc.serialize<iom_broker_pb.ExecutionResponse>;
    responseDeserialize: grpc.deserialize<iom_broker_pb.ExecutionResponse>;
}
interface IExecutionServiceService_ICloseConnection extends grpc.MethodDefinition<google_protobuf_empty_pb.Empty, iom_broker_pb.CloseConnectionResponse> {
    path: "/iomBroker.ExecutionService/CloseConnection";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<google_protobuf_empty_pb.Empty>;
    requestDeserialize: grpc.deserialize<google_protobuf_empty_pb.Empty>;
    responseSerialize: grpc.serialize<iom_broker_pb.CloseConnectionResponse>;
    responseDeserialize: grpc.deserialize<iom_broker_pb.CloseConnectionResponse>;
}
interface IExecutionServiceService_IFetchLog extends grpc.MethodDefinition<google_protobuf_empty_pb.Empty, iom_broker_pb.LogChunk> {
    path: "/iomBroker.ExecutionService/FetchLog";
    requestStream: false;
    responseStream: true;
    requestSerialize: grpc.serialize<google_protobuf_empty_pb.Empty>;
    requestDeserialize: grpc.deserialize<google_protobuf_empty_pb.Empty>;
    responseSerialize: grpc.serialize<iom_broker_pb.LogChunk>;
    responseDeserialize: grpc.deserialize<iom_broker_pb.LogChunk>;
}

export const ExecutionServiceService: IExecutionServiceService;

export interface IExecutionServiceServer extends grpc.UntypedServiceImplementation {
    setupConnection: grpc.handleUnaryCall<iom_broker_pb.ConnectionContext, iom_broker_pb.SetupConnectionResponse>;
    executeCode: grpc.handleUnaryCall<iom_broker_pb.ExecutionRequest, iom_broker_pb.ExecutionResponse>;
    closeConnection: grpc.handleUnaryCall<google_protobuf_empty_pb.Empty, iom_broker_pb.CloseConnectionResponse>;
    fetchLog: grpc.handleServerStreamingCall<google_protobuf_empty_pb.Empty, iom_broker_pb.LogChunk>;
}

export interface IExecutionServiceClient {
    setupConnection(request: iom_broker_pb.ConnectionContext, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.SetupConnectionResponse) => void): grpc.ClientUnaryCall;
    setupConnection(request: iom_broker_pb.ConnectionContext, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.SetupConnectionResponse) => void): grpc.ClientUnaryCall;
    setupConnection(request: iom_broker_pb.ConnectionContext, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.SetupConnectionResponse) => void): grpc.ClientUnaryCall;
    executeCode(request: iom_broker_pb.ExecutionRequest, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.ExecutionResponse) => void): grpc.ClientUnaryCall;
    executeCode(request: iom_broker_pb.ExecutionRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.ExecutionResponse) => void): grpc.ClientUnaryCall;
    executeCode(request: iom_broker_pb.ExecutionRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.ExecutionResponse) => void): grpc.ClientUnaryCall;
    closeConnection(request: google_protobuf_empty_pb.Empty, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.CloseConnectionResponse) => void): grpc.ClientUnaryCall;
    closeConnection(request: google_protobuf_empty_pb.Empty, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.CloseConnectionResponse) => void): grpc.ClientUnaryCall;
    closeConnection(request: google_protobuf_empty_pb.Empty, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.CloseConnectionResponse) => void): grpc.ClientUnaryCall;
    fetchLog(request: google_protobuf_empty_pb.Empty, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<iom_broker_pb.LogChunk>;
    fetchLog(request: google_protobuf_empty_pb.Empty, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<iom_broker_pb.LogChunk>;
}

export class ExecutionServiceClient extends grpc.Client implements IExecutionServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public setupConnection(request: iom_broker_pb.ConnectionContext, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.SetupConnectionResponse) => void): grpc.ClientUnaryCall;
    public setupConnection(request: iom_broker_pb.ConnectionContext, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.SetupConnectionResponse) => void): grpc.ClientUnaryCall;
    public setupConnection(request: iom_broker_pb.ConnectionContext, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.SetupConnectionResponse) => void): grpc.ClientUnaryCall;
    public executeCode(request: iom_broker_pb.ExecutionRequest, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.ExecutionResponse) => void): grpc.ClientUnaryCall;
    public executeCode(request: iom_broker_pb.ExecutionRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.ExecutionResponse) => void): grpc.ClientUnaryCall;
    public executeCode(request: iom_broker_pb.ExecutionRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.ExecutionResponse) => void): grpc.ClientUnaryCall;
    public closeConnection(request: google_protobuf_empty_pb.Empty, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.CloseConnectionResponse) => void): grpc.ClientUnaryCall;
    public closeConnection(request: google_protobuf_empty_pb.Empty, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.CloseConnectionResponse) => void): grpc.ClientUnaryCall;
    public closeConnection(request: google_protobuf_empty_pb.Empty, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: iom_broker_pb.CloseConnectionResponse) => void): grpc.ClientUnaryCall;
    public fetchLog(request: google_protobuf_empty_pb.Empty, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<iom_broker_pb.LogChunk>;
    public fetchLog(request: google_protobuf_empty_pb.Empty, metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientReadableStream<iom_broker_pb.LogChunk>;
}
