// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import SASContentAdapter from "../../connection/rest/SASContentAdapter";
import { ConnectionType } from "../profile";
import {
  ContentAdapter,
  ContentNavigatorConfig,
  ContentSourceType,
} from "./types";

class ContentAdapterFactory {
  // TODO #889 Update this to return RestSASServerAdapter & ITCSASServerAdapter
  public create(
    connectionType: ConnectionType,
    sourceType: ContentNavigatorConfig["sourceType"],
  ): ContentAdapter {
    const key = `${connectionType}.${sourceType}`;
    switch (key) {
      case `${ConnectionType.Rest}.${ContentSourceType.SASContent}`:
      default:
        return new SASContentAdapter();
    }
  }
}

export default ContentAdapterFactory;
