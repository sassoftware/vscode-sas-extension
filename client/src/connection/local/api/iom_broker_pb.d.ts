// package: iomBroker
// file: iom_broker.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";
import * as google_protobuf_empty_pb from "google-protobuf/google/protobuf/empty_pb";

export class ExecutionRequest extends jspb.Message { 
    getCode(): string;
    setCode(value: string): ExecutionRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ExecutionRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ExecutionRequest): ExecutionRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ExecutionRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ExecutionRequest;
    static deserializeBinaryFromReader(message: ExecutionRequest, reader: jspb.BinaryReader): ExecutionRequest;
}

export namespace ExecutionRequest {
    export type AsObject = {
        code: string,
    }
}

export class ExecutionResponse extends jspb.Message { 
    getRc(): number;
    setRc(value: number): ExecutionResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ExecutionResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ExecutionResponse): ExecutionResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ExecutionResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ExecutionResponse;
    static deserializeBinaryFromReader(message: ExecutionResponse, reader: jspb.BinaryReader): ExecutionResponse;
}

export namespace ExecutionResponse {
    export type AsObject = {
        rc: number,
    }
}

export class SetupConnectionResponse extends jspb.Message { 
    getRc(): number;
    setRc(value: number): SetupConnectionResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SetupConnectionResponse.AsObject;
    static toObject(includeInstance: boolean, msg: SetupConnectionResponse): SetupConnectionResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SetupConnectionResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SetupConnectionResponse;
    static deserializeBinaryFromReader(message: SetupConnectionResponse, reader: jspb.BinaryReader): SetupConnectionResponse;
}

export namespace SetupConnectionResponse {
    export type AsObject = {
        rc: number,
    }
}

export class ConnectionContext extends jspb.Message { 
    getHost(): string;
    setHost(value: string): ConnectionContext;
    getUsername(): string;
    setUsername(value: string): ConnectionContext;
    getPassword(): string;
    setPassword(value: string): ConnectionContext;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ConnectionContext.AsObject;
    static toObject(includeInstance: boolean, msg: ConnectionContext): ConnectionContext.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ConnectionContext, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ConnectionContext;
    static deserializeBinaryFromReader(message: ConnectionContext, reader: jspb.BinaryReader): ConnectionContext;
}

export namespace ConnectionContext {
    export type AsObject = {
        host: string,
        username: string,
        password: string,
    }
}

export class CloseConnectionResponse extends jspb.Message { 
    getRc(): number;
    setRc(value: number): CloseConnectionResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CloseConnectionResponse.AsObject;
    static toObject(includeInstance: boolean, msg: CloseConnectionResponse): CloseConnectionResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CloseConnectionResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CloseConnectionResponse;
    static deserializeBinaryFromReader(message: CloseConnectionResponse, reader: jspb.BinaryReader): CloseConnectionResponse;
}

export namespace CloseConnectionResponse {
    export type AsObject = {
        rc: number,
    }
}

export class LogChunk extends jspb.Message { 
    getContent(): string;
    setContent(value: string): LogChunk;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): LogChunk.AsObject;
    static toObject(includeInstance: boolean, msg: LogChunk): LogChunk.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: LogChunk, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): LogChunk;
    static deserializeBinaryFromReader(message: LogChunk, reader: jspb.BinaryReader): LogChunk;
}

export namespace LogChunk {
    export type AsObject = {
        content: string,
    }
}

export class ErrorResponse extends jspb.Message { 
    getCode(): number;
    setCode(value: number): ErrorResponse;
    getMessage(): string;
    setMessage(value: string): ErrorResponse;
    clearDetailsList(): void;
    getDetailsList(): Array<string>;
    setDetailsList(value: Array<string>): ErrorResponse;
    addDetails(value: string, index?: number): string;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ErrorResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ErrorResponse): ErrorResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ErrorResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ErrorResponse;
    static deserializeBinaryFromReader(message: ErrorResponse, reader: jspb.BinaryReader): ErrorResponse;
}

export namespace ErrorResponse {
    export type AsObject = {
        code: number,
        message: string,
        detailsList: Array<string>,
    }
}
