// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Messages } from "./const";
import { ContentSourceType } from "./types";

const INVALID_FILE_CHARS_REGEX = /[?:;{}\\/<>*"|]/;
const HAS_EXTENSION_REGEX = /^.+\.\w+$/;

export const validateFileName = (
  value: string,
  sourceType: ContentSourceType,
): string | null => {
  // Keep source type parameter for API consistency with caller paths.
  void sourceType;
  if (
    !HAS_EXTENSION_REGEX.test(value) ||
    INVALID_FILE_CHARS_REGEX.test(value)
  ) {
    return Messages.FileValidationError;
  }

  return null;
};

export const validateFolderName = (
  value: string,
  sourceType: ContentSourceType,
): string | null => {
  const regex =
    sourceType === ContentSourceType.SASServer
      ? new RegExp(/[:/?\\*"|<>]/g)
      : new RegExp(/[/;\\{}<>]/g);

  return value.length <= 100 && !regex.test(value)
    ? null
    : Messages.FolderValidationError;
};
