// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
