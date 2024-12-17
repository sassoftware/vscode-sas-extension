// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/*
 * fakeFileSystem.ts
 *
 * simulate real fs access.
 */
import { CaseSensitivityDetector } from "pyright-internal-browser/dist/packages/pyright-internal/src/common/caseSensitivityDetector";
import { ConsoleInterface } from "pyright-internal-browser/dist/packages/pyright-internal/src/common/console";
import type {
  FileSystem,
  TempFile,
  TmpfileOptions,
} from "pyright-internal-browser/dist/packages/pyright-internal/src/common/fileSystem";
import { FileWatcherProvider } from "pyright-internal-browser/dist/packages/pyright-internal/src/common/fileWatcher";
import {
  directoryExists,
  getDirectoryPath,
} from "pyright-internal-browser/dist/packages/pyright-internal/src/common/pathUtils";
import { Uri } from "pyright-internal-browser/dist/packages/pyright-internal/src/common/uri/uri";
import { UriEx } from "pyright-internal-browser/dist/packages/pyright-internal/src/common/uri/uriUtils";
import { TestFileSystem } from "pyright-internal-browser/dist/packages/pyright-internal/src/tests/harness/vfs/filesystem";

import { typeShed } from "./typeShed";

const fs = new TestFileSystem(false, { cwd: "/" });

export function createFromRealFileSystem(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  console?: ConsoleInterface,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fileWatcherProvider?: FileWatcherProvider,
): FileSystem {
  // install builtin types
  for (const entry of typeShed) {
    const dir = getDirectoryPath(entry.filePath);
    if (!directoryExists(fs, dir)) {
      fs.mkdirpSync(dir);
    }
    fs.writeFileSync(UriEx.parse(entry.filePath), entry.content);
  }

  return fs;
}

export class RealTempFile implements TempFile, CaseSensitivityDetector {
  private tmpDirPath: string = "pyright-tmp";
  private tmpFilePath: string = this.tmpDirPath + "/pyright-tmp-file";

  constructor() {
    // Empty
  }

  tmpdir(): Uri {
    if (!fs.existsSync(UriEx.parse(this.tmpDirPath))) {
      fs.mkdirpSync(this.tmpDirPath);
    }
    return Uri.file(this.tmpDirPath, this);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tmpfile(options?: TmpfileOptions): Uri {
    const file = UriEx.parse(this.tmpFilePath);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, "");
    }
    return Uri.file(file.fileName, this);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isCaseSensitive(uri: string): boolean {
    // if (uri.startsWith(FileUriSchema)) {
    //     return this._isLocalFileSystemCaseSensitive();
    // }

    return true;
  }
}
