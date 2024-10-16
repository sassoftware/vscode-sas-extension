// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ColorThemeKind,
  window,
} from "vscode";

import { getHtmlStyle } from "../../components/utils/settings";

// To change the html style of SASPy
export const saspyGetHtmlStyleValue = (): string => {
  const htmlStyleSetting = getHtmlStyle();

  switch (htmlStyleSetting) {
    case "(auto)":
      switch (window.activeColorTheme.kind) {
        case ColorThemeKind.Light:
          return "Illuminate";
        case ColorThemeKind.Dark:
          return "Ignite";
        case ColorThemeKind.HighContrast:
          return "HighContrast";
        case ColorThemeKind.HighContrastLight:
          return "Illuminate";
        default:
          return "";
      }
    case "(server default)":
      return "";
    default:
      return htmlStyleSetting;
  }
}
