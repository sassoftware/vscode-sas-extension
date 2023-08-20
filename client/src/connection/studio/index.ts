// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AxiosInstance } from "axios";

function getStudioSessionRequest(connection: AxiosInstance) {
  const date = new Date();
  const timeZoneOffset = date.getTimezoneOffset();
  // Extract hours and minutes from the time zone offset
  const hoursOffset = Math.floor(Math.abs(timeZoneOffset) / 60);
  const minutesOffset = Math.abs(timeZoneOffset) % 60;
  // Convert the time zone offset to the desired format (e.g., "GMT+02:00")
  const formattedTimeZoneOffset = `GMT${
    timeZoneOffset >= 0 ? "-" : "+"
  }${hoursOffset.toString().padStart(2, "0")}:${minutesOffset
    .toString()
    .padStart(2, "0")}`;
  // Create the request body
  return JSON.stringify({
    baseUri: connection.getUri() + "/SASStudio/",
    locale: "en_US",
    zone: formattedTimeZoneOffset,
  });
}

function getflowObjRequest(
  name: string,
  resourceId: string,
  parentResourceId: string,
) {
  return JSON.stringify({
    name: name,
    uri: "sascontent:" + resourceId,
    parentUri: "sascontent:" + parentResourceId,
    currentParentUri: null,
  });
}

export async function createStudioSession(
  connection: AxiosInstance,
): Promise<string> {
  const studioSessionRequest = getStudioSessionRequest(connection);
  const res = await connection.post("/studio/sessions", studioSessionRequest, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  return res.data.id;
}

export async function associateFlowObject(
  name: string,
  resourceId: string,
  parentResourceId: string,
  sessionId: string,
  connection: AxiosInstance,
): Promise<string> {
  const flowObjRequest = getflowObjRequest(name, resourceId, parentResourceId);
  const response = await connection.post(
    "/SASStudio/sasexec/{sessionId}/associateFlowObj".replace(
      `{${"sessionId"}}`,
      sessionId,
    ),
    flowObjRequest,
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
      },
    },
  );
  return response.data.uri;
}
