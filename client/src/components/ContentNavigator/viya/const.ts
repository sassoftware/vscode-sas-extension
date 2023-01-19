const CONTENT_FOLDER_ID = "CONTENT_FOLDER_ID";
const ROOT_FOLDER_TYPE = "RootFolder";

export const ROOT_FOLDER = {
  // actual root for service
  id: CONTENT_FOLDER_ID,
  name: "SAS Content",
  type: ROOT_FOLDER_TYPE,
  uri: CONTENT_FOLDER_ID,
  links: [
    {
      method: "GET",
      rel: "members",
      href: "/folders/folders",
      uri: "/folders/folders",
    },
    {
      method: "GET",
      rel: "self",
      href: CONTENT_FOLDER_ID,
      uri: CONTENT_FOLDER_ID,
    },
  ],
};

export const FILE_TYPES = ["file"];
export const FOLDER_TYPES = [
  ROOT_FOLDER_TYPE,
  "folder",
  "myFolder",
  "favoritesFolder",
  "userFolder",
  "userRoot",
  "trashFolder",
  // "hiddenFolder", "historyFolder", "applicationDataFolder"
];
