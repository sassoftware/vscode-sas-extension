// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const temporaryLibrefs = new Set<string>();

const librefToPathMap = new Map<string, string>();

export function trackTemporaryLibrary(
  libref: string,
  folderPath?: string,
): void {
  const upperLibref = libref.toUpperCase();
  temporaryLibrefs.add(libref.toUpperCase());
  if (folderPath) {
    librefToPathMap.set(upperLibref, folderPath);
  }
}

export function untrackTemporaryLibrary(libref: string): void {
  const upperLibref = libref.toUpperCase();
  temporaryLibrefs.delete(upperLibref);
  librefToPathMap.delete(upperLibref);
}

export function getTrackedTemporaryLibraries(): string[] {
  return [...temporaryLibrefs];
}

export function getTemporaryLibraryPath(libref: string): string | undefined {
  return librefToPathMap.get(libref.toUpperCase());
}

export function getTemporaryLibraryAtPath(
  folderPath: string,
): string | undefined {
  for (const [libref, path] of librefToPathMap.entries()) {
    if (path.toLowerCase() === folderPath.toLowerCase()) {
      return libref;
    }
  }
  return undefined;
}

export function clearTrackedTemporaryLibraries(): void {
  temporaryLibrefs.clear();
  librefToPathMap.clear();
}
