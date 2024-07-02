import { FileType, Uri, authentication } from "vscode";

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
  isContainer,
  isItemInRecycleBin,
  isReference,
} from "../../components/ContentNavigator/utils";
import {
  getItemContentType,
  getLink,
  getPermission,
  getResourceId,
  getResourceIdFromItem,
  getTypeName,
  getUri,
  resourceType,
} from "./util";

class SASContentAdapter implements ContentAdapter {
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
    this.viyaCadence = await this.getViyaCadence();
  }

  public getConnection() {
    return this.connection;
  }

  public getRootFolder(name: string): ContentItem | undefined {
    return this.rootFolders[name];
  }

  public get myFavoritesFolder(): ContentItem | undefined {
    return this.getRootFolder("@myFavorites");
  }

  public async getParentOfItem(
    item: ContentItem,
  ): Promise<ContentItem | undefined> {
    const ancestorsLink = getLink(item.links, "GET", "ancestors");
    if (!ancestorsLink) {
      return;
    }
    const { data } = await this.connection.get(ancestorsLink.uri);
    if (data && data.length > 0) {
      return this.enrichWithDataProviderProperties(data[0]);
    }
  }

  public async getChildItems(parentItem: ContentItem): Promise<ContentItem[]> {
    const { data: result } = await this.connection.get(
      await this.generatedMembersUrlForParentItem(parentItem),
    );
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

    return result.items.map(
      (childItem: ContentItem, index): ContentItem => ({
        ...childItem,
        uid: `${parentItem.uid}/${index}`,
        ...this.enrichWithDataProviderProperties(childItem, {
          isInRecycleBin,
          isInMyFavorites,
        }),
      }),
    );
  }

  public async getFolderPathForItem(item: ContentItem): Promise<string> {
    if (!item) {
      return "";
    }

    const filePathParts = [];
    let currentContentItem: Pick<ContentItem, "parentFolderUri" | "name"> =
      item;
    do {
      try {
        const { data: parentData } = await this.connection.get(
          currentContentItem.parentFolderUri,
        );
        currentContentItem = parentData;
      } catch (e) {
        return "";
      }

      filePathParts.push(currentContentItem.name);
    } while (currentContentItem.parentFolderUri);

    return "/" + filePathParts.reverse().join("/");
  }

  public async moveItem(
    item: ContentItem,
    parentFolderUri: string,
  ): Promise<boolean> {
    const newItemData = { ...item, parentFolderUri };
    const updateLink = getLink(item.links, "PUT", "update");
    try {
      await this.connection.put(updateLink.uri, newItemData);
    } catch (error) {
      return false;
    }
    return true;
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
          "Invalid state: FolderService object has no self link : " +
            parentItem.name,
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
        ...this.enrichWithDataProviderProperties(result.data),
      };
    }

    return this.rootFolders;
  }

  public async getItemOfId(id: string): Promise<ContentItem> {
    const response = await this.connection.get(id);
    this.updateFileMetadata(id, response);

    return this.enrichWithDataProviderProperties(response.data);
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
    return await this.getContentOfUri(item.vscUri);
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
      return this.enrichWithDataProviderProperties(createFolderResponse.data);
    } catch (error) {
      return;
    }
  }

  private enrichWithDataProviderProperties(
    item: ContentItem,
    flags?: ContentItem["flags"],
  ): ContentItem {
    item.flags = flags;
    return {
      ...item,
      permission: getPermission(item),
      contextValue: resourceType(item),
      fileStat: {
        ctime: item.creationTimeStamp,
        mtime: item.modifiedTimeStamp,
        size: 0,
        type: getIsContainer(item) ? FileType.Directory : FileType.File,
      },
      isReference: isReference(item),
      resourceId: getResourceIdFromItem(item),
      vscUri: getUri(item, flags?.isInRecycleBin || false),
      typeName: getTypeName(item),
    };

    function getIsContainer(item: ContentItem): boolean {
      const typeName = getTypeName(item);
      if (isItemInRecycleBin(item) && isReference(item)) {
        return false;
      }
      if (FOLDER_TYPES.indexOf(typeName) >= 0) {
        return true;
      }
      return false;
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

      return this.enrichWithDataProviderProperties(patchResponse.data);
    } catch (error) {
      return;
    }
  }

  public async createNewItem(
    parentItem: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ): Promise<ContentItem | undefined> {
    const typeDef = await this.getTypeDefinition(fileName);
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

    return this.enrichWithDataProviderProperties(createdResource);
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

  public async getUriOfItem(item: ContentItem): Promise<Uri> {
    if (item.type !== "reference") {
      return item.vscUri;
    }

    // If we're attempting to open a favorite, open the underlying file instead.
    try {
      return (await this.getItemOfId(item.uri)).vscUri;
    } catch (error) {
      return item.vscUri;
    }
  }

  public async deleteItem(item: ContentItem): Promise<boolean> {
    // folder service will return 409 error if the deleting folder has non-folder item even if add recursive parameter
    // delete the resource or move item to recycle bin will automatically delete the favorites as well.
    return await (isContainer(item)
      ? this.deleteFolder(item)
      : this.deleteResource(item));
  }

  public async addItemToFavorites(item: ContentItem): Promise<boolean> {
    return await this.addChildItem(
      getResourceIdFromItem(item),
      getLink(this.myFavoritesFolder.links, "POST", "addMember").uri,
      {
        type: "reference",
        name: item.name,
        contentType: item.contentType,
      },
    );
  }

  public async removeItemFromFavorites(item: ContentItem): Promise<boolean> {
    const deleteMemberUri = await this.deleteMemberUriForFavorite(item);
    if (!deleteMemberUri) {
      return false;
    }

    try {
      await this.connection.delete(deleteMemberUri);
    } catch (error) {
      return false;
    }
    return true;
  }

  public async recycleItem(
    item: ContentItem,
  ): Promise<{ newUri?: Uri; oldUri?: Uri }> {
    const recycleBin = this.getRootFolder("@myRecycleBin");
    if (!recycleBin) {
      // fallback to delete
      return recycleItemResponse(await this.deleteItem(item));
    }
    const recycleBinUri = getLink(recycleBin.links, "GET", "self")?.uri;
    if (!recycleBinUri) {
      return {};
    }

    const success = await this.moveItem(item, recycleBinUri);
    return recycleItemResponse(success);

    function recycleItemResponse(success: boolean) {
      if (!success) {
        return {};
      }

      return {
        newUri: getUri(item, true),
        oldUri: getUri(item),
      };
    }
  }

  public async restoreItem(item: ContentItem): Promise<boolean> {
    const previousParentUri = getLink(item.links, "GET", "previousParent")?.uri;
    if (!previousParentUri) {
      return false;
    }
    return await this.moveItem(item, previousParentUri);
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

  private async deleteFolder(item: ContentItem): Promise<boolean> {
    try {
      const children = await this.getChildItems(item);
      await Promise.all(children.map((child) => this.deleteItem(child)));
      const deleteRecursivelyLink = getLink(
        item.links,
        "DELETE",
        "deleteRecursively",
      )?.uri;
      const deleteResourceLink = getLink(
        item.links,
        "DELETE",
        "deleteResource",
      )?.uri;
      if (!deleteRecursivelyLink && !deleteResourceLink) {
        return false;
      }
      const deleteLink =
        deleteRecursivelyLink ?? `${deleteResourceLink}?recursive=true`;
      await this.connection.delete(deleteLink);
    } catch (error) {
      return false;
    }
    return true;
  }

  private async deleteResource(item: ContentItem): Promise<boolean> {
    const deleteResourceLink = getLink(
      item.links,
      "DELETE",
      "deleteResource",
    )?.uri;
    if (!deleteResourceLink) {
      return false;
    }
    try {
      await this.connection.delete(deleteResourceLink);
    } catch (error) {
      return false;
    }
    // Due to delay in folders service's automatic deletion of associated member we need
    // to attempt manual deletion of member to ensure subsequent data refreshes don't occur before
    // member is deleted. Per Gary Williams, we must do these steps sequentially not concurrently.
    // If member already deleted, server treats this call as NO-OP.
    try {
      const deleteLink = getLink(item.links, "DELETE", "delete")?.uri;
      if (deleteLink) {
        await this.connection.delete(deleteLink);
      }
    } catch (error) {
      return error.response.status === 404 || error.response.status === 403;
    }
    return true;
  }

  private async getViyaCadence(): Promise<string> {
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

  private async getTypeDefinition(fileName: string): Promise<string> {
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

  private async deleteMemberUriForFavorite(item: ContentItem): Promise<string> {
    if (item.flags?.isInMyFavorites) {
      return getLink(item.links, "DELETE", "delete")?.uri;
    }

    const myFavoritesFolder = this.getRootFolder("@myFavorites");
    const allFavorites = await this.getChildItems(myFavoritesFolder);
    const favoriteId = allFavorites.find(
      (favorite) =>
        getResourceIdFromItem(favorite) === getResourceIdFromItem(item),
    )?.id;
    if (!favoriteId) {
      return undefined;
    }

    return `${getResourceIdFromItem(myFavoritesFolder)}/members/${favoriteId}`;
  }
}

export default SASContentAdapter;
