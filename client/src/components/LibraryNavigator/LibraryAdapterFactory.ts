// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import ItcLibraryAdapter from "../../connection/itc/ItcLibraryAdapter";
import RestLibraryAdapter from "../../connection/rest/RestLibraryAdapter";
import SaspyLibraryAdapter from "../../connection/saspy/SaspyLibraryAdapter";
import { ConnectionType } from "../profile";
import { LibraryAdapter } from "./types";

class LibraryAdapterFactory {
  public create(connectionType: ConnectionType): LibraryAdapter {
    switch (connectionType) {
      case ConnectionType.IOM:
      case ConnectionType.COM:
        return new ItcLibraryAdapter();
      case ConnectionType.SASPY:
        return new SaspyLibraryAdapter();
      case ConnectionType.Rest:
      default:
        return new RestLibraryAdapter();
    }
  }
}

export default LibraryAdapterFactory;
