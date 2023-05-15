import { Session } from "..";
import { getSession as getIOMSession, Config as IOMConfig } from "./iom";
import { getSession as getSTDIOSession, Config as BatchConfig } from "./batch";
export const getSession = (c: IOMConfig): Session => {
  return getIOMSession(c);
  //return getSTDIOSession(c);
};
