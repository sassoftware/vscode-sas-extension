import { Uri, authentication } from "vscode";

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";

import { SASAuthProvider } from "../../components/AuthProvider";
import {
  DEFAULT_FILE_CONTENT_TYPE,
  FILE_TYPES,
  FOLDER_TYPES,
  ROOT_FOLDER,
  ROOT_FOLDERS,
  TRASH_FOLDER_TYPE,
} from "../../components/ContentNavigator/const";
import {
  AddChildItemProperties,
  ContentAdapter,
  ContentItem,
  Link,
  RootFolderMap,
} from "../../components/ContentNavigator/types";
import {
  getFileContentType,
  getItemContentType,
  getLink,
  getPermission,
  getResourceId,
  getResourceIdFromItem,
  getTypeName,
  getUri,
} from "../../components/ContentNavigator/utils";

class RestContentAdapter implements ContentAdapter {
  private connection: AxiosInstance;
  private authorized: boolean;
  private viyaCadence: string;
  private rootFolders: RootFolderMap;
  private fileMetadataMap: {
    [id: string]: { etag: string; lastModified: string; contentType: string };
  };

  public constructor() {
    this.rootFolders = {};
    this.fileMetadataMap = {};
  }

  public connected(): boolean {
    return this.authorized;
  }

  public async connect(baseURL: string): Promise<void> {
    this.connection = axios.create({ baseURL });
    this.connection.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest: AxiosRequestConfig & { _retry?: boolean } =
          error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          await this.updateAccessToken();
          return this.connection(originalRequest);
        }

        return Promise.reject(error);
      },
    );
    await this.updateAccessToken();

    this.authorized = true;
    this.viyaCadence = await getViyaCadence();

    async function getViyaCadence(): Promise<string> {
      try {
        const { data } = await this.connection.get(
          "/deploymentData/cadenceVersion",
        );
        return data.cadenceVersion;
      } catch (e) {
        console.error("fail to retrieve the viya cadence");
      }
      return "unknown";
    }
  }

  public get myFavoritesFolder(): ContentItem | undefined {
    return this.rootFolders["@myFavorites"];
  }

  public async getParentOfItem(
    item: ContentItem,
  ): Promise<ContentItem | undefined> {
    const ancestorsLink = getLink(item.links, "GET", "ancestors");
    if (!ancestorsLink) {
      return;
    }
    const resp = await this.connection.get(ancestorsLink.uri);
    if (resp.data && resp.data.length > 0) {
      return resp.data[0];
    }
  }

  public async getChildItems(parentItem: ContentItem): Promise<ContentItem[]> {
    const res = await this.connection.get(
      await this.generatedMembersUrlForParentItem(parentItem),
    );
    const result = res.data;
    if (!result.items) {
      return Promise.reject();
    }

    const myFavoritesFolder = this.myFavoritesFolder;
    const isInRecycleBin =
      TRASH_FOLDER_TYPE === getTypeName(parentItem) ||
      parentItem.flags?.isInRecycleBin;
    const isInMyFavorites =
      getResourceIdFromItem(parentItem) ===
      getResourceIdFromItem(myFavoritesFolder);

    return result.items.map((childItem: ContentItem, index) => ({
      ...childItem,
      uid: `${parentItem.uid}/${index}`,
      permission: getPermission(childItem),
      flags: {
        isInRecycleBin,
        isInMyFavorites,
      },
    }));
  }

  private async generatedMembersUrlForParentItem(
    parentItem: ContentItem,
  ): Promise<string> {
    const parentIsContent = parentItem.uri === ROOT_FOLDER.uri;
    const typeQuery = generateTypeQuery(parentIsContent);

    const membersLink = getLink(parentItem.links, "GET", "members");
    let membersUrl = membersLink ? membersLink.uri : null;
    if (!membersUrl && parentItem.uri) {
      membersUrl = `${parentItem.uri}/members`;
    }

    if (!membersUrl) {
      const selfLink = getLink(parentItem.links, "GET", "self");
      if (!selfLink) {
        console.error(
          "Invalid state: FolderService object has no self link : " + item.name,
        );
        return Promise.reject({ status: 404 });
      }
      membersUrl = selfLink.uri + "/members";
    }

    membersUrl = membersUrl + "?limit=1000000";

    const filters = [];

    if (parentIsContent) {
      filters.push("isNull(parent)");
    }
    if (typeQuery) {
      filters.push(typeQuery);
    }

    if (filters.length === 1) {
      membersUrl = membersUrl + "&filter=" + filters[0];
    } else if (filters.length > 1) {
      membersUrl = membersUrl + "&filter=and(" + filters.join(",") + ")";
    }

    membersUrl =
      membersUrl +
      `&sortBy=${
        parentIsContent || this.viyaCadence === "2023.03" // 2023.03 fails query with this sortBy param
          ? ""
          : "eq(contentType,'folder'):descending,"
      }name:primary:ascending,type:ascending`;

    return membersUrl;

    function generateTypeQuery(parentIsContent: boolean): string {
      // Generate type query segment if applicable
      let typeQuery = "";
      // Determine the set of types on which to filter
      const includedTypes = FILE_TYPES.concat(FOLDER_TYPES);

      // Generate type query string
      typeQuery = "in(" + (parentIsContent ? "type" : "contentType") + ",";
      for (let i = 0; i < includedTypes.length; i++) {
        typeQuery += "'" + includedTypes[i] + "'";
        if (i !== includedTypes.length - 1) {
          typeQuery += ",";
        }
      }
      typeQuery += ")";

      return typeQuery;
    }
  }

  public async getRootItems(): Promise<RootFolderMap> {
    for (let index = 0; index < ROOT_FOLDERS.length; ++index) {
      const delegateFolderName = ROOT_FOLDERS[index];
      const result =
        delegateFolderName === "@sasRoot"
          ? { data: ROOT_FOLDER }
          : await this.connection.get(`/folders/folders/${delegateFolderName}`);

      this.rootFolders[delegateFolderName] = {
        ...result.data,
        uid: `${index}`,
        permission: getPermission(result.data),
      };
    }

    return this.rootFolders;
  }

  public async getItemOfId(id: string): Promise<ContentItem> {
    const res = await this.connection.get(id);
    this.updateFileMetadata(id, res);
    return res.data;
  }

  public async getItemOfUri(uri: Uri): Promise<ContentItem> {
    const resourceId = getResourceId(uri);
    return await this.getItemOfId(resourceId);
  }

  public async getContentOfUri(uri: Uri): Promise<string> {
    const resourceId = getResourceId(uri);
    const { data } = await this.connection.get(resourceId + "/content", {
      responseType: "arraybuffer",
    });

    return data;
  }

  public async getContentOfItem(item: ContentItem): Promise<string> {
    const uri = getUri(item);
    return await this.getContentOfUri(uri);
  }

  public async createNewFolder(
    parentItem: ContentItem,
    folderName: string,
  ): Promise<ContentItem | undefined> {
    const parentFolderUri =
      parentItem.uri ||
      getLink(parentItem.links || [], "GET", "self")?.uri ||
      null;
    if (!parentFolderUri) {
      return;
    }

    try {
      const createFolderResponse = await this.connection.post(
        `/folders/folders?parentFolderUri=${parentFolderUri}`,
        { name: folderName },
      );
      return createFolderResponse.data;
    } catch (error) {
      return;
    }
  }

  public async renameItem(
    item: ContentItem,
    newName: string,
  ): Promise<ContentItem | undefined> {
    const itemIsReference = item.type === "reference";
    const uri = itemIsReference
      ? getLink(item.links, "GET", "self").uri
      : item.uri;

    try {
      const validationUri = getLink(item.links, "PUT", "validateRename")?.uri;
      if (validationUri) {
        await this.connection.put(
          validationUri
            .replace("{newname}", encodeURI(newName))
            .replace("{newtype}", getTypeName(item)),
        );
      }

      // not sure why but the response of moveTo request does not return the latest etag so request it every time
      const fileData = await this.getItemOfId(uri);
      const contentType = getFileContentType(newName);
      const fileMetadata = this.fileMetadataMap[uri];
      const patchResponse = await this.connection.put(
        uri,
        { ...fileData, name: newName },
        {
          headers: {
            "If-Unmodified-Since": fileMetadata.lastModified,
            "If-Match": fileMetadata.etag,
            "Content-Type": getItemContentType(item),
          },
        },
      );

      this.updateFileMetadata(uri, patchResponse, contentType);

      // The links in My Favorites are of type reference. Instead of passing
      // back the reference objects, we want to pass back the underlying source
      // objects.
      if (itemIsReference) {
        return await this.getItemOfId(item.uri);
      }

      return patchResponse.data;
    } catch (error) {
      return;
    }
  }

  public async createNewItem(
    parentItem: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ): Promise<ContentItem | undefined> {
    const typeDef = await getTypeDefinition(fileName);
    let createdResource: ContentItem;
    try {
      const fileCreationResponse = await this.connection.post<ContentItem>(
        `/files/files#rawUpload?typeDefName=${typeDef}`,
        buffer || Buffer.from("", "binary"),
        {
          headers: {
            "Content-Type": getFileContentType(fileName),
            "Content-Disposition": `filename*=UTF-8''${encodeURI(fileName)}`,
            Accept: "application/vnd.sas.file+json",
          },
        },
      );
      createdResource = fileCreationResponse.data;
    } catch (error) {
      return;
    }

    const fileLink: Link | null = getLink(createdResource.links, "GET", "self");
    const memberAdded = await this.addChildItem(
      fileLink?.uri,
      getLink(parentItem.links, "POST", "addMember")?.uri,
      {
        name: fileName,
        contentType: typeDef,
      },
    );
    if (!memberAdded) {
      return;
    }

    return createdResource;

    async function getTypeDefinition(fileName: string): Promise<string> {
      const defaultContentType = "file";
      const ext = fileName.split(".").pop().toLowerCase();
      if (ext === "sas") {
        return "programFile";
      }

      try {
        const typeResponse = await this.connection.get(
          `/types/types?filter=contains('extensions', '${ext}')`,
        );

        if (typeResponse.data.items && typeResponse.data.items.length !== 0) {
          return typeResponse.data.items[0].name;
        }
      } catch {
        return defaultContentType;
      }

      return defaultContentType;
    }
  }

  public async addChildItem(
    childItemUri: string | undefined,
    parentItemUri: string | undefined,
    properties: AddChildItemProperties,
  ): Promise<boolean> {
    if (!childItemUri || !parentItemUri) {
      return false;
    }

    try {
      await this.connection.post(parentItemUri, {
        uri: childItemUri,
        type: "CHILD",
        ...properties,
      });
    } catch (error) {
      return false;
    }

    return true;
  }

  private async updateAccessToken(): Promise<void> {
    const session = await authentication.getSession(SASAuthProvider.id, [], {
      createIfNone: true,
    });
    this.connection.defaults.headers.common.Authorization = `Bearer ${session.accessToken}`;
  }

  private updateFileMetadata(
    id: string,
    { headers, data }: AxiosResponse,
    contentType?: string,
  ) {
    this.fileMetadataMap[id] = {
      etag: headers.etag,
      lastModified: headers["last-modified"],
      contentType: contentType || data.contentType,
    };
  }

  public async updateContentOfItem(uri: Uri, content: string): Promise<void> {
    const resourceId = getResourceId(uri);
    const { etag, lastModified, contentType } = this.getFileInfo(resourceId);
    const headers = {
      "Content-Type": contentType,
      "If-Unmodified-Since": lastModified,
    };
    if (etag !== "") {
      headers["If-Match"] = etag;
    }
    try {
      const res = await this.connection.put(resourceId + "/content", content, {
        headers,
      });
      this.updateFileMetadata(resourceId, res, contentType);
    } catch (error) {
      console.log(error);
    }
  }

  private getFileInfo(resourceId: string): {
    etag: string;
    lastModified: string;
    contentType: string;
  } {
    if (resourceId in this.fileMetadataMap) {
      return this.fileMetadataMap[resourceId];
    }
    const now = new Date();
    const timestamp = now.toUTCString();
    return {
      etag: "",
      lastModified: timestamp,
      contentType: DEFAULT_FILE_CONTENT_TYPE,
    };
  }
}

export default RestContentAdapter;
