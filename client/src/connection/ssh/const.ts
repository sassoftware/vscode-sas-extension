// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const SECOND = 1000;
const MINUTE = 60 * SECOND;
export const KEEPALIVE_INTERVAL = 60 * SECOND; //How often (in milliseconds) to send SSH-level keepalive packets to the server. Set to 0 to disable.
export const KEEPALIVE_UNANSWERED_THRESHOLD =
  (15 * MINUTE) / KEEPALIVE_INTERVAL; //How many consecutive, unanswered SSH-level keepalive packets that can be sent to the server before disconnection.
export const WORK_DIR_START_TAG = "<WorkDirectory>";
export const WORK_DIR_END_TAG = "</WorkDirectory>";
export const CONNECT_READY_TIMEOUT = 5 * MINUTE; //allow extra time due to possible prompting
