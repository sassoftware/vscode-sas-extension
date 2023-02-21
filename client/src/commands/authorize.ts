import { authentication, commands } from "vscode";
import { SASAuthProvider } from "../components/AuthProvider";
import { profileConfig, switchProfile } from "./profile";

export const checkProfileAndAuthorize = async (): Promise<void> => {
  commands.executeCommand("setContext", "SAS.authorizing", true);
  if (profileConfig.getActiveProfile() === "") {
    await switchProfile();
  }

  if (profileConfig.getActiveProfile() !== "") {
    try {
      await authentication.getSession(SASAuthProvider.id, [], {
        createIfNone: true,
      });
    } catch (error) {
      // Do nothing here. We just want to make sure we're resetting
      // context option below.
    }
  }

  commands.executeCommand("setContext", "SAS.authorizing", false);
};
