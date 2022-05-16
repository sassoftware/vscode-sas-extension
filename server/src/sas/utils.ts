// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

export interface TextPosition {
  line: number;
  column: number;
}

export interface TextRange {
  start: TextPosition;
  end: TextPosition;
}

export function arrayToMap(arr: string[] | number[]): Record<string, 1> {
  const map: Record<string, 1> = {};
  for (const key of arr) {
    map[key] = 1;
  }
  return map;
}

let bundle: Record<string, string>;
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
  }
  let result = bundle[key];
  if (arg) {
    result = result.replace("{0}", arg);
  }
  return result;
}
