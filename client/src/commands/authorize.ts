// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { authentication, commands, window } from "vscode";

import { SASAuthProvider } from "../components/AuthProvider";
import LibraryNavigator from "../components/LibraryNavigator";
import { ConnectionType } from "../components/profile";
import { profileConfig, switchProfile } from "./profile";

const finishAuthorization = (profileConfig): boolean => {
  commands.executeCommand("setContext", "SAS.authorizing", false);
  return profileConfig.getActiveProfile() !== "";
};

export const checkProfileAndAuthorize =
  (libraryNavigator: LibraryNavigator) => async (): Promise<boolean> => {
    commands.executeCommand("setContext", "SAS.authorizing", true);
    if (profileConfig.getActiveProfile() === "") {
      await switchProfile();
    }

    if (profileConfig.getActiveProfile() === "") {
      return finishAuthorization(profileConfig);
    }

    const activeProfile = profileConfig.getProfileByName(
      profileConfig.getActiveProfile(),
    );

    switch (activeProfile.connectionType) {
      case ConnectionType.Rest:
        try {
          await authentication.getSession(SASAuthProvider.id, [], {
            createIfNone: true,
          });
        } catch (error) {
          window.showErrorMessage(error.message);
        }

        return finishAuthorization(profileConfig);
      case ConnectionType.IOM:
      case ConnectionType.COM:
        commands.executeCommand("setContext", "SAS.librariesDisplayed", true);
        commands.executeCommand("setContext", "SAS.serverDisplayed", true);
        libraryNavigator.refresh();
        return finishAuthorization(profileConfig);
      default:
        return finishAuthorization(profileConfig);
    }
  };
