import { LogLine } from "./rest/api/compute";
import { getSession as getRestSession } from "./rest";
import { AuthType, ProfileConfig } from "../components/profile";

let profileConfig: ProfileConfig;

export interface RunResult {
  html5?: string;
}

export interface Session {
  setup(): Promise<void>;
  run(code: string, onLog?: (logs: LogLine[]) => void): Promise<RunResult>;
  close(): Promise<void> | void;
}

export function getSession(): Session {
  if (!profileConfig) {
    profileConfig = new ProfileConfig();
  }
  // retrieve active & valid profile
  const activeProfile = profileConfig.getActiveProfileDetail();
  const validProfile = profileConfig.validateProfile(activeProfile);

  if (validProfile.type === AuthType.Error) {
    throw new Error(validProfile.error);
  }
  if (/^https*:/.test(validProfile.profile.endpoint))
    return getRestSession(validProfile.profile);

  throw new Error("Invalid endpoint");
}
