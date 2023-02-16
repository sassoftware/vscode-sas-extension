import { authentication, commands } from "vscode";
import { SASAuthProvider } from "../components/AuthProvider";
import { profileConfig, switchProfile } from "./profile";

export const checkProfileAndAuthorize = async (): Promise<void> => {
  commands.executeCommand("setContext", "SAS.authorizing", true);
  if (profileConfig.getActiveProfile() === "") {
    await switchProfile();
  }

  if (profileConfig.getActiveProfile() !== "") {
    await authentication.getSession(SASAuthProvider.id, [], {
      createIfNone: true,
    });
  }

  commands.executeCommand("setContext", "SAS.authorizing", false);
};
