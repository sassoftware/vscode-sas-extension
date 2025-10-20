// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// `localize` provides functionality to use localized strings in react webviews
// This expects for translations to be defined in a script block with an id of
// `l10-messages`.
let localizedTerms = null;
const localize = (term: string) => {
  if (!localizedTerms) {
    try {
      localizedTerms = JSON.parse(
        document.querySelector("#l10n-messages").textContent,
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return term;
    }
  }

  return localizedTerms[term] ?? term;
};

export default localize;
