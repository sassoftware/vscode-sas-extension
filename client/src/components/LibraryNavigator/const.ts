// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

export const Messages = {
  TableDeletionError: l10n.t("Unable to delete table {tableName}."),
  TablesDeletionWarning: l10n.t(
    "Are you sure you want to delete {count} table(s): {tableNames}?",
  ),
  ViewTableCommandTitle: l10n.t("View SAS Table"),
};

export const Icons = {
  DataSet: {
    light: "icons/light/sasDataSetLight.svg",
    dark: "icons/dark/sasDataSetDark.svg",
  },
  ReadOnlyLibrary: {
    light: "icons/light/readOnlyLibraryLight.svg",
    dark: "icons/dark/readOnlyLibraryDark.svg",
  },
  Library: {
    light: "icons/light/libraryLight.svg",
    dark: "icons/dark/libraryDark.svg",
  },
  WorkLibrary: {
    light: "icons/light/workLibraryLight.svg",
    dark: "icons/dark/workLibraryDark.svg",
  },
};

export const DefaultRecordLimit = 100;
export const WorkLibraryId = "WORK";
