// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { Disposable } from "vscode";

export interface SubscriptionProvider {
  getSubscriptions(): Disposable[];
}
