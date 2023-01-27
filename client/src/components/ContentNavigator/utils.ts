import { Uri } from "vscode";
import { Link } from "./types";

export const getLink = (
  links: Array<Link>,
  method: string,
  relationship: string
): Link | null =>
  !links || links.length === 0
    ? null
    : links.find((link) => link.method === method && link.rel === relationship);

export const getResourceId = (uri: Uri): string => uri.query.substring(3); // ?id=...
