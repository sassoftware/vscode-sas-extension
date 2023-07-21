// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  createInputTextBox,
  ProfilePromptType,
  ProfileConfig,
} from "../components/profile";
import { l10n, window } from "vscode";

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
    await addProfile();
    return;
  }
  const selected = await window.showQuickPick(profileList, {
    placeHolder: l10n.t("Select a SAS connection profile"),
  });
  if (selected) {
    await profileConfig.prompt(selected);
  }
}

/**
 * Switch profile command modifies the configuration file and and updates the
 * active profile and serializes the changes in the configuration file.
 */
export async function switchProfile(): Promise<void> {
  const profileList = profileConfig.listProfile();
  if (profileList.length === 0) {
    await addProfile();
    return;
  }
  const selected = await window.showQuickPick(profileList, {
    placeHolder: l10n.t("Select a SAS connection profile"),
  });
  if (selected) {
    profileConfig.updateActiveProfileSetting(selected);
  }
}

/**
 * Delete profile command will prompt the user to choose a profile name to
 * delete from the profile list.  The delete wil then serialize the changes
 * to the configuration file.
 */
export async function deleteProfile(): Promise<void> {
  const profileList = profileConfig.listProfile();
  if (profileList.length === 0) {
    window.showErrorMessage(l10n.t("No Profiles available to delete"));
    return;
  }
  const selected = await window.showQuickPick(profileList, {
    placeHolder: l10n.t("Select a SAS connection profile"),
  });
  if (selected) {
    profileConfig.deleteProfile(selected);
    window.showInformationMessage(
      l10n.t(
        "The {selected} SAS connection profile has been deleted from the settings.json file.",
        { selected },
      ),
    );
  }
}
