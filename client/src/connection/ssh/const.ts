// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const SECOND = 1000;
export const KEEPALIVE_INTERVAL = 60 * SECOND; //How often (in milliseconds) to send SSH-level keepalive packets to the server. Set to 0 to disable.
// 720 * 60 seconds = 43200 seconds = 12 hours
export const KEEPALIVE_UNANSWERED_THRESHOLD = 720; //How many consecutive, unanswered SSH-level keepalive packets that can be sent to the server before disconnection.
export const WORK_DIR_START_TAG = "<WorkDirectory>";
export const WORK_DIR_END_TAG = "</WorkDirectory>";
export const SAS_LAUNCH_TIMEOUT = 60000;
export const SUPPORTED_AUTH_METHODS = [
  "publickey",
  "password",
  "keyboard-interactive",
];
