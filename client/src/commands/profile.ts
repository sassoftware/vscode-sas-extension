// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { createInputTextBox, ProfilePromptType } from "../viya/profile";
import { ProfileConfig } from "../viya/profile";
import { window } from "vscode";
import { run, runSelected } from "../commands/run";

export const profileConfig = new ProfileConfig();
/**
 * Add profile command prompts the user to create a profile by a given name
 * and then proceeds to prompt the user for profile values to be initialied.
 * When a profile is added, this profile will automatically be set as the active
 * profile and will be serialized in the configuration file.
 */
export async function addProfile(): Promise<void> {
  const profileName = await createInputTextBox(ProfilePromptType.NewProfile);
  if (profileName) {
    await profileConfig
      .prompt(profileName)
      .then(() => profileConfig.updateActiveProfileSetting(profileName));
  }
}

/**
 * Update profile command prompts the user to choose a profile to update
 * and then proceeds to prompt for the profile values to reinitialized.
 * When a profile is updated the profile will automatically be serialized
 * in the configuration file.
 */
export async function updateProfile(): Promise<void> {
  const profileList = profileConfig.listProfile();
  if (profileList.length === 0) {
    addProfile();
    return;
  }
  const selected = await window.showQuickPick(profileList, {
    placeHolder: "Select a SAS connection profile",
  });
  if (selected) {
    await profileConfig.prompt(selected, true);
  }
}

/**
 * Switch profile command modifies the configuration file and and updates the
 * active profile and serializes the changes in the configuration file.
 */
export async function switchProfile(): Promise<void> {
  const profileList = profileConfig.listProfile();
  if (profileList.length === 0) {
    addProfile();
    return;
  }
  const selected = await window.showQuickPick(profileList, {
    placeHolder: "Select a SAS connection profile",
  });
  if (selected) {
    profileConfig.updateActiveProfileSetting(selected);
  }
}

/**
 * validateProfileAndRun command validates that at least one profile exists
 * before attempting to run
 */
export async function validateProfileAndRun(): Promise<void> {
  const profileList = await profileConfig.listProfile();
  if (profileList.length === 0) {
    addProfile();
    return;
  }
  run();
}

/**
 * validateProfileAndRunSelected command validates that at least one profile exists
 * before attempting to run
 */
 export async function validateProfileAndRunSelected(): Promise<void> {
  const profileList = await profileConfig.listProfile();
  if (profileList.length === 0) {
    addProfile();
    return;
  }
  runSelected();
}

/**
 * Delete profile command will prompt the user to choose a profile name to
 * delete from the profile list.  The delete wil then serialize the changes
 * to the configuration file.
 */
export async function deleteProfile(): Promise<void> {
  const profileList = profileConfig.listProfile();
  if (profileList.length === 0) {
    window.showErrorMessage("No Profiles available to delete");
    return;
  }
  const selected = await window.showQuickPick(profileList, {
    placeHolder: "Select a SAS connection profile",
  });
  if (selected) {
    profileConfig.deleteProfile(selected);
    window.showInformationMessage(
      `The ${selected} SAS connection profile has been deleted from the settings.json file.`
    );
  }
}
