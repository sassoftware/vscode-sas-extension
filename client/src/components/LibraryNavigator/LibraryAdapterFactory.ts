// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import ItcLibraryAdapter from "../../connection/itc/ItcLibraryAdapter";
import RestLibraryAdapter from "../../connection/rest/RestLibraryAdapter";
import { ConnectionType } from "../profile";
import { LibraryAdapter } from "./types";

class LibraryAdapterFactory {
  public create(
    connectionType: ConnectionType,
    onConnect?: () => void,
  ): LibraryAdapter {
    switch (connectionType) {
      case ConnectionType.IOM:
      case ConnectionType.COM:
        return new ItcLibraryAdapter(onConnect);
      case ConnectionType.Rest:
      default:
        return new RestLibraryAdapter(onConnect);
    }
  }
}

export default LibraryAdapterFactory;
