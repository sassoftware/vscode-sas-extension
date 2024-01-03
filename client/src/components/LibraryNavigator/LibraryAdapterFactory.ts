// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import RestLibraryAdapter from "../../connection/rest/RestLibraryAdapter";
import { ConnectionType } from "../profile";
import { LibraryAdapter } from "./types";

class LibraryAdapterFactory {
  public create(connectionType: ConnectionType): LibraryAdapter {
    switch (connectionType) {
      case ConnectionType.Rest:
      default:
        return new RestLibraryAdapter();
    }
  }
}

export default LibraryAdapterFactory;
