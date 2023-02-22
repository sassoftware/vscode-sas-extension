// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { authentication, commands, window } from "vscode";
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
      window.showErrorMessage(error.message);
    }
  }

  commands.executeCommand("setContext", "SAS.authorizing", false);
};
