// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Localisation bundle the host serialised onto `<body data-l10n>`. Falls back
// to the key if absent.
let bundle: Record<string, string> | undefined;
export function l10n(key: string): string {
  if (!bundle) {
    try {
      bundle = JSON.parse(document.body.dataset.l10n || "{}");
    } catch {
      bundle = {};
    }
  }
  return bundle[key] ?? key;
}
