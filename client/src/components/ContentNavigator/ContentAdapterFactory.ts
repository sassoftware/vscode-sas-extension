// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import ItcServerAdapter from "../../connection/itc/ItcServerAdapter";
import RestContentAdapter from "../../connection/rest/RestContentAdapter";
import RestServerAdapter from "../../connection/rest/RestServerAdapter";
import { ConnectionType, ProfileWithFileRootOptions } from "../profile";
import {
  ContentAdapter,
  ContentNavigatorConfig,
  ContentSourceType,
} from "./types";

class ContentAdapterFactory {
  public create(
    connectionType: ConnectionType,
    fileNavigationCustomRootPath: ProfileWithFileRootOptions["fileNavigationCustomRootPath"],
    fileNavigationRoot: ProfileWithFileRootOptions["fileNavigationRoot"],
    sourceType: ContentNavigatorConfig["sourceType"],
  ): ContentAdapter {
    const key = `${connectionType}.${sourceType}`;
    switch (key) {
      case `${ConnectionType.Rest}.${ContentSourceType.SASServer}`:
        return new RestServerAdapter(
          fileNavigationCustomRootPath,
          fileNavigationRoot,
        );
      case `${ConnectionType.IOM}.${ContentSourceType.SASServer}`:
      case `${ConnectionType.COM}.${ContentSourceType.SASServer}`:
        return new ItcServerAdapter(
          fileNavigationCustomRootPath,
          fileNavigationRoot,
        );
      case `${ConnectionType.Rest}.${ContentSourceType.SASContent}`:
      default:
        return new RestContentAdapter();
    }
  }
}

export default ContentAdapterFactory;
