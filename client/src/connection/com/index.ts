import { Session } from "..";
import { getSession as getIOMSession, Config as IOMConfig } from "./iom";
import { getSession as getSTDIOSession, Config as BatchConfig } from "./batch";
import { getSession as getCOMSession, Config as COMConfig } from "./com";
export const getSession = (c: COMConfig): Session => {
  //return getIOMSession(c);
  //return getSTDIOSession(c);
  return getCOMSession(c);
};
