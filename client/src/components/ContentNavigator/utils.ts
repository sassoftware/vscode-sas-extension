import { Uri } from "vscode";
import { Link } from "./types";

export const getLink = (
  links: Array<Link>,
  method: string,
  relationship: string
): Link | null =>
  !links
    ? null
    : links.find((link) => link.method === method && link.rel === relationship);

export const ajaxErrorHandler = (error) => {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.log(error.response.data);
    console.log(error.response.status);
    console.log(error.response.headers);
  } else if (error.request) {
    // The request was made but no response was received
    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    console.log(error.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    console.log("Error", error.message);
  }
  console.log(error.config);
};

export const getResourceId = (uri: Uri): string => {
  return uri.query.substring(3); // ?id=...
};
