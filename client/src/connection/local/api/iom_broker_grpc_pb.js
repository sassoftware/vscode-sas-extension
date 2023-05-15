// GENERATED CODE -- DO NOT EDIT!

"use strict";
var grpc = require("@grpc/grpc-js");
var iom_broker_pb = require("./iom_broker_pb.js");
var google_protobuf_empty_pb = require("google-protobuf/google/protobuf/empty_pb.js");

function serialize_google_protobuf_Empty(arg) {
  if (!(arg instanceof google_protobuf_empty_pb.Empty)) {
    throw new Error("Expected argument of type google.protobuf.Empty");
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_google_protobuf_Empty(buffer_arg) {
  return google_protobuf_empty_pb.Empty.deserializeBinary(
    new Uint8Array(buffer_arg)
  );
}

function serialize_iomBroker_CloseConnectionResponse(arg) {
  if (!(arg instanceof iom_broker_pb.CloseConnectionResponse)) {
    throw new Error(
      "Expected argument of type iomBroker.CloseConnectionResponse"
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iomBroker_CloseConnectionResponse(buffer_arg) {
  return iom_broker_pb.CloseConnectionResponse.deserializeBinary(
    new Uint8Array(buffer_arg)
  );
}

function serialize_iomBroker_ConnectionContext(arg) {
  if (!(arg instanceof iom_broker_pb.ConnectionContext)) {
    throw new Error("Expected argument of type iomBroker.ConnectionContext");
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iomBroker_ConnectionContext(buffer_arg) {
  return iom_broker_pb.ConnectionContext.deserializeBinary(
    new Uint8Array(buffer_arg)
  );
}

function serialize_iomBroker_ExecutionRequest(arg) {
  if (!(arg instanceof iom_broker_pb.ExecutionRequest)) {
    throw new Error("Expected argument of type iomBroker.ExecutionRequest");
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iomBroker_ExecutionRequest(buffer_arg) {
  return iom_broker_pb.ExecutionRequest.deserializeBinary(
    new Uint8Array(buffer_arg)
  );
}

function serialize_iomBroker_ExecutionResponse(arg) {
  if (!(arg instanceof iom_broker_pb.ExecutionResponse)) {
    throw new Error("Expected argument of type iomBroker.ExecutionResponse");
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iomBroker_ExecutionResponse(buffer_arg) {
  return iom_broker_pb.ExecutionResponse.deserializeBinary(
    new Uint8Array(buffer_arg)
  );
}

function serialize_iomBroker_FileChunk(arg) {
  if (!(arg instanceof iom_broker_pb.FileChunk)) {
    throw new Error("Expected argument of type iomBroker.FileChunk");
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iomBroker_FileChunk(buffer_arg) {
  return iom_broker_pb.FileChunk.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iomBroker_LogChunk(arg) {
  if (!(arg instanceof iom_broker_pb.LogChunk)) {
    throw new Error("Expected argument of type iomBroker.LogChunk");
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iomBroker_LogChunk(buffer_arg) {
  return iom_broker_pb.LogChunk.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_iomBroker_SetupConnectionResponse(arg) {
  if (!(arg instanceof iom_broker_pb.SetupConnectionResponse)) {
    throw new Error(
      "Expected argument of type iomBroker.SetupConnectionResponse"
    );
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_iomBroker_SetupConnectionResponse(buffer_arg) {
  return iom_broker_pb.SetupConnectionResponse.deserializeBinary(
    new Uint8Array(buffer_arg)
  );
}

var ExecutionServiceService = (exports.ExecutionServiceService = {
  setupConnection: {
    path: "/iomBroker.ExecutionService/SetupConnection",
    requestStream: false,
    responseStream: false,
    requestType: iom_broker_pb.ConnectionContext,
    responseType: iom_broker_pb.SetupConnectionResponse,
    requestSerialize: serialize_iomBroker_ConnectionContext,
    requestDeserialize: deserialize_iomBroker_ConnectionContext,
    responseSerialize: serialize_iomBroker_SetupConnectionResponse,
    responseDeserialize: deserialize_iomBroker_SetupConnectionResponse,
  },
  executeCode: {
    path: "/iomBroker.ExecutionService/ExecuteCode",
    requestStream: false,
    responseStream: false,
    requestType: iom_broker_pb.ExecutionRequest,
    responseType: iom_broker_pb.ExecutionResponse,
    requestSerialize: serialize_iomBroker_ExecutionRequest,
    requestDeserialize: deserialize_iomBroker_ExecutionRequest,
    responseSerialize: serialize_iomBroker_ExecutionResponse,
    responseDeserialize: deserialize_iomBroker_ExecutionResponse,
  },
  closeConnection: {
    path: "/iomBroker.ExecutionService/CloseConnection",
    requestStream: false,
    responseStream: false,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: iom_broker_pb.CloseConnectionResponse,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_iomBroker_CloseConnectionResponse,
    responseDeserialize: deserialize_iomBroker_CloseConnectionResponse,
  },
  fetchLog: {
    path: "/iomBroker.ExecutionService/FetchLog",
    requestStream: false,
    responseStream: true,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: iom_broker_pb.LogChunk,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_iomBroker_LogChunk,
    responseDeserialize: deserialize_iomBroker_LogChunk,
  },
  fetchODS: {
    path: "/iomBroker.ExecutionService/FetchODS",
    requestStream: false,
    responseStream: true,
    requestType: google_protobuf_empty_pb.Empty,
    responseType: iom_broker_pb.FileChunk,
    requestSerialize: serialize_google_protobuf_Empty,
    requestDeserialize: deserialize_google_protobuf_Empty,
    responseSerialize: serialize_iomBroker_FileChunk,
    responseDeserialize: deserialize_iomBroker_FileChunk,
  },
});

exports.ExecutionServiceClient = grpc.makeGenericClientConstructor(
  ExecutionServiceService
);
