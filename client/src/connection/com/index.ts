import { Session } from "..";
import { getSession as getCOMSession, Config as COMConfig } from "./com";
export const getSession = (c: COMConfig): Session => {
  return getCOMSession(c);
};
