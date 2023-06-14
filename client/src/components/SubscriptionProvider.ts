// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Disposable } from "vscode";

export interface SubscriptionProvider {
  getSubscriptions(): Disposable[];
}
