// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { createInputTextBox, ProfilePromptType } from "../viya/profile";
import { create as activeProfileTrackerCreate } from "../components/profilemanager/active-profile-tracker";
import { ProfileConfig } from "../viya/profile";
import * as configuration from "../components/config";
import { closeSession } from "../commands/closeSession";
import { window } from "vscode";


export const profileConfig = new ProfileConfig(configuration.getConfigFile(), function () {
  return {};
});
export const activeProfileTracker = activeProfileTrackerCreate(profileConfig);


/**
 * Add profile command prompts the user to create a profile by a given name
 * and then proceeds to prompt the user for profile values to be initialied.
 * When a profile is added, this profile will automatically be set as the active
 * profile and will be serialized in the configuration file.
 */
export async function addProfile(): Promise<void> {
  const profileName = await createInputTextBox(ProfilePromptType.NewProfile);
  if (!profileName) {
    addProfile();
    return;
  }
  await profileConfig.prompt(profileName).then(() => {
    activeProfileTracker.setActive(profileName);
    closeSession(true);
  });
}

/**
 * Update profile command prompts the user to choose a profile to update
 * and then proceeds to prompt for the profile values to reinitialized.
 * When a profile is updated the profile will automatically be serialized
 * in the configuration file.
 */
export async function updateProfile(): Promise<void> {
  const profileList = await profileConfig.listProfile();
  if (profileList.length === 0) {
    addProfile();
    return;
  }
  const selected = await window.showQuickPick(profileList, {
    placeHolder: "Update SAS profile",
  });
  if (selected) {
    await profileConfig.prompt(selected, true).then(() => {
      activeProfileTracker.setActive(selected);
      closeSession(true);
    });
  }
}

/**
 * Switch profile command modifies the configuration file and and updates the
 * active profile and serializes the changes in the configuration file.
 */
export async function switchProfile(): Promise<void> {
  const profileList = await profileConfig.listProfile();
  if (profileList.length === 0) {
    addProfile();
    return;
  }
  const selected = await window.showQuickPick(profileList, {
    placeHolder: "Select SAS profile",
  });
  if (selected) {
    await profileConfig.setActiveProfile(selected).then(() => {
      activeProfileTracker.setActive(selected);
      closeSession(true);
    });
  }
}

/**
 * Delete profile command will prompt the user to choose a profile name to
 * delete from the profile list.  The delete wil then serialize the changes
 * to the configuration file.
 */
export async function deleteProfile(): Promise<void> {
  const profileList = await profileConfig.listProfile();
  if (profileList.length === 0) {
    window.showErrorMessage("No Profiles available to delete");
    return;
  }
  const selected = await window.showQuickPick(profileList, {
    placeHolder: "Delete SAS profile",
  });
  if (selected) {
    await profileConfig.deleteProfile(selected).then(() => {
      window.showInformationMessage(
        `SAS Profile ${selected} removed from the configuration`
      );
      closeSession(true);
    });
  }
}
