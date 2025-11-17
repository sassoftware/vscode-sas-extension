// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useMemo, useState } from "react";

const THEME_ATTRIBUTE = "data-vscode-theme-kind";
const SELECTOR = `[${THEME_ATTRIBUTE}]`;

/**
 * This listens for changes to vscode's theme kind and updates our internal
 * theme to match.
 * @returns theme:string matching the ag grid theme for the vscode theme kind
 */
const useTheme = () => {
  const [themeKind, setThemeKind] = useState(
    document.querySelector(SELECTOR).getAttribute(THEME_ATTRIBUTE),
  );
  useEffect(() => {
    const obs = new MutationObserver((record) =>
      setThemeKind(
        (record[0].target as HTMLElement).getAttribute(THEME_ATTRIBUTE),
      ),
    );
    obs.observe(document.querySelector(SELECTOR), {
      attributes: true,
      attributeFilter: [THEME_ATTRIBUTE],
    });
    return () => {
      obs.disconnect();
    };
  }, []);

  const theme = useMemo(() => {
    switch (themeKind) {
      case "vscode-high-contrast-light":
      case "vscode-light":
        return "ag-theme-alpine";
      case "vscode-high-contrast":
      case "vscode-dark":
        return "ag-theme-alpine-dark";
    }
  }, [themeKind]);

  return theme;
};

export default useTheme;
