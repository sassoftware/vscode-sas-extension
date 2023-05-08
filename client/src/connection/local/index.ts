import { Session } from "..";
import { getSession as getIOMSession, Config } from "./iom";
export const getSession = (c: Config): Session => {
  return getIOMSession(c);
};
