// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { window, workspace, ColorThemeKind } from "vscode";

export function wrapCode(code: string): string {
  const outputHtml = !!workspace
    .getConfiguration("SAS")
    .get("results.html.enabled");
  const htmlStyle: string = workspace
    .getConfiguration("SAS")
    .get("results.html.style");

  if (outputHtml) {
    let odsStyle;
    switch (htmlStyle) {
      case "(auto)":
        switch (window.activeColorTheme.kind) {
          case ColorThemeKind.Light:
            odsStyle = "Illuminate";
            break;
          case ColorThemeKind.Dark:
            odsStyle = "Ignite";
            break;
          case ColorThemeKind.HighContrast:
            odsStyle = "HighContrast";
            break;
          case ColorThemeKind.HighContrastLight:
            odsStyle = "Illuminate";
            break;
          default:
            odsStyle = "";
            break;
        }
        break;
      case "(server default)":
        odsStyle = "";
        break;
      default:
        odsStyle = htmlStyle;
        break;
    }

    const usercode = code;
    code = `ods html5`;
    if (odsStyle) {
      code += ` style=${odsStyle}`;
    }
    code += ";\n" + usercode + "\n;run;quit;ods html5 close;";
  }
  return code;
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject: (reason?: any) => void;
}

export function deferred<T>() {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const deferred = {} as Deferred<T>;
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}

/**
 * Run tasks with limited concurrency
 * @param tasks array of tasks to run
 * @param limit limit of tasks that can run in parallel
 * @returns a promise like `Promise.all`
 */
export function throttle<T>(tasks: Array<() => Promise<T>>, limit: number) {
  const total = tasks.length;
  const results: T[] = Array(total);
  let count = 0;
  return new Promise<T[]>((resolve, reject) => {
    function run() {
      const index = total - tasks.length;
      if (index === total) {
        if (count === total) {
          resolve(results);
        }
        return;
      }
      const task = tasks.shift();
      task().then((result) => {
        results[index] = result;
        ++count;
        run();
      }, reject);
    }
    Array(limit).fill(0).forEach(run);
  });
}
