// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ResLoader } from "../node/ResLoader";

export interface TextPosition {
  line: number;
  column: number;
}

export interface TextRange {
  start: TextPosition;
  end: TextPosition;
}

export function isSamePosition(pos1: TextPosition, pos2: TextPosition) {
  return pos1.line === pos2.line && pos1.column === pos2.column;
}

export function arrayToMap(arr: string[] | number[]): Record<string, 1> {
  const map: Record<string, 1> = {};
  for (const key of arr) {
    map[key] = 1;
  }
  return map;
}

let bundle: Record<string, string>;
const locale: string =
  typeof process !== "undefined" && process.env.VSCODE_NLS_CONFIG
    ? JSON.parse(process.env.VSCODE_NLS_CONFIG).locale
    : navigator?.language ?? "en";
const supportedLanguages = [
  "ar",
  "cs",
  "da",
  "de",
  "el",
  "es",
  "fi",
  "fr",
  "he",
  "hr",
  "hu",
  "it",
  "iw",
  "ja",
  "ko",
  "nb",
  "nl",
  "no",
  "pl",
  "pt_BR",
  "pt",
  "ru",
  "sh",
  "sk",
  "sl",
  "sr",
  "sv",
  "th",
  "tr",
  "uk",
  "zh_CN",
  "zh_TW",
];
export function getText(key: string, arg?: string): string {
  if (!bundle) {
    bundle = {};
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("../../messagebundle.properties")
      .split("\n")
      .forEach((pair: string) => {
        const [key, value] = pair.split("=");
        bundle[key] = value;
      });

    if (locale !== "en") {
      const localeString = locale.replace("-", "_").toLowerCase();
      let index = supportedLanguages.findIndex(
        (l) => l.toLowerCase() === localeString,
      );
      if (index === -1) {
        const parentLocale = locale.split("-")[0];
        index = supportedLanguages.indexOf(parentLocale);
      }
      if (index >= 0) {
        ResLoader.getBundle(supportedLanguages[index])
          .split("\n")
          .forEach((pair: string) => {
            const [key, value] = pair.split("=");
            if (key && value) {
              bundle[key] = value.replace(/\\u(.{4})/g, (_, p1) =>
                String.fromCodePoint(parseInt(p1, 16)),
              );
            }
          });
      }
    }
  }
  let result = bundle[key];
  if (arg) {
    result = result.replace("{0}", arg);
  }
  return result;
}
