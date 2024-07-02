import SASContentAdapter from "../../connection/rest/SASContentAdapter";
import { ConnectionType } from "../profile";
import { ContentAdapter } from "./types";

class ContentAdapterFactory {
  // TODO #889 Update this to return RestSASServerAdapter & ITCSASServerAdapter
  public create(connectionType: ConnectionType): ContentAdapter {
    switch (connectionType) {
      default:
        return new SASContentAdapter();
    }
  }
}

export default ContentAdapterFactory;
