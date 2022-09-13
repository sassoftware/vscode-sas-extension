// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { readFileSync } from "fs";
import { window, workspace, ConfigurationTarget } from "vscode";
import { closeSession } from "../viya/compute";

export const EXTENSION_CONFIG_KEY = "SAS";
export const EXTENSION_DEFINE_PROFILES_CONFIG_KEY = "defineConnectionProfiles";
export const EXTENSION_PROFILES_CONFIG_KEY = "profiles";
export const EXTENSION_ACTIVE_PROFILE_CONFIG_KEY = "activeProfile";

/**
 * The default compute context that will be used to create a SAS session.
 */
export const DEFAULT_COMPUTE_CONTEXT = "SAS Job Execution compute context";

/**
 * Dictionary is a type that maps a generic object with a string key.
 */
export type Dictionary<T> = {
  [key: string]: T;
};

/**
 * Enum that represents the authentication type for a profile.
 */
export enum AuthType {
  TokenFile = "tokenFile",
  Password = "password",
  Error = "error",
}

/**
 * Profile is an interface that represents a users profile.  Currently
 * supports two different authentication flows, token and password
 * flow with the clientId and clientSecret.
 */
export interface Profile {
  endpoint: string;
  clientId?: string;
  clientSecret?: string;
  context?: string;
  username?: string;
  tokenFile?: string;
}

/**
 * Profile detail is an interface that encapsulates the name of the profile
 * with the {@link Profile}.
 */
export interface ProfileDetail {
  name: string;
  profile: Profile;
}

/**
 * Profile validation is an interface that represents the validation
 * information from a profile needed when making a SAS connection.
 */
export interface ProfileValidation {
  type: AuthType;
  error: string;
  data?: string;
  profile: Profile;
}

/**
 * ProfileConfig manages a list of {@link Profile}s that are located in vscode settings.
 * Connection Profiles are designed to keep track of multiple
 * configurations of SAS Connections.
 */
export class ProfileConfig {
  /**
   * Validates settings.json to confirm that SAS.defineConnectionProfiles exists
   * as a key, and updates it, if the setting does not exists
   *
   * @returns Boolean for pass or fail
   */
  validateSettings(): boolean {
    const profileList: Dictionary<Profile> = workspace
      .getConfiguration(EXTENSION_CONFIG_KEY)
      .get(EXTENSION_DEFINE_PROFILES_CONFIG_KEY)[EXTENSION_PROFILES_CONFIG_KEY];
    if (!profileList) {
      workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          {},
          ConfigurationTarget.Global
        );
      return false;
    }
    return true;
  }

  /**
   * Get the active profile from the vscode settings.
   *
   * @returns String name to the active profile
   */
  getActiveProfile(): string {
    if (!this.validateSettings()) {
      return "";
    }
    const activeProfile: string = workspace
      .getConfiguration(EXTENSION_CONFIG_KEY)
      .get(EXTENSION_DEFINE_PROFILES_CONFIG_KEY)[
      EXTENSION_ACTIVE_PROFILE_CONFIG_KEY
    ];
    return activeProfile;
  }

  /**
   * Gets all profiles from the vscode settings.
   *
   * @returns Dictionary of profiles
   */
  getAllProfiles(): Dictionary<Profile> {
    if (!this.validateSettings()) {
      return {};
    }
    const profileList: Dictionary<Profile> = workspace
      .getConfiguration(EXTENSION_CONFIG_KEY)
      .get(EXTENSION_DEFINE_PROFILES_CONFIG_KEY)[EXTENSION_PROFILES_CONFIG_KEY];

    return profileList;
  }

  /**
   * Update VSCode settings with profile dictionary
   *
   * @param profileDict {@link Dictionary<Profile>} the value for the key
   */
  async updateProfileSetting(profileDict: Dictionary<Profile>): Promise<void> {
    const currentActiveProfile = this.getActiveProfile();
    const profiles = {
      activeProfile: currentActiveProfile,
      profiles: profileDict,
    };
    await workspace
      .getConfiguration(EXTENSION_CONFIG_KEY)
      .update(
        EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
        profiles,
        ConfigurationTarget.Global
      );
  }

  /**
   * Update VSCode settings with active profile
   *
   * @param activeProfileParam {@link String} the value for the key
   */
  async updateActiveProfileSetting(activeProfileParam: string): Promise<void> {
    const profileList = this.getAllProfiles();
    const profiles = {
      activeProfile: activeProfileParam,
      profiles: profileList,
    };
    if (activeProfileParam in profileList) {
      closeSession();
    } else {
      profiles.activeProfile = "";
    }
    await workspace
      .getConfiguration(EXTENSION_CONFIG_KEY)
      .update(
        EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
        profiles,
        ConfigurationTarget.Global
      );
  }

  /**
   * Determines the number of profiles found in settings
   *
   * @returns number of profiles found in vscode settings
   */
  length(): number {
    return Object.keys(this.getAllProfiles()).length;
  }

  /**
   * Retreives the list of profile names.
   *
   * @returns List of profile names
   */
  listProfile(): string[] {
    return Object.keys(this.getAllProfiles());
  }

  /**
   * Retrieves the {@link Profile} by name from the profile configuration.  If the profile
   * is not found by name, a default {@link Profile} will be generated and returned.
   *
   * @param name {@link String} of the profile name
   * @returns Profile object
   */
  getProfileByName(name: string): Profile {
    let profile: Profile = undefined;
    const profileList = this.getAllProfiles();
    if (name in profileList) {
      profile = profileList[name];
    }
    return profile;
  }

  /**
   * Retrieves the {@link ProfileDetail} of the active profile set in the profile
   * configurations.
   *
   * @returns Optional ProfileDetail
   */
  async getActiveProfileDetail(): Promise<ProfileDetail | undefined> {
    const activeProfileName = this.getActiveProfile();

    const profileList = this.getAllProfiles();
    if (activeProfileName in profileList) {
      return <ProfileDetail>{
        name: activeProfileName,
        profile: profileList[activeProfileName],
      };
    } else {
      return undefined;
    }
  }

  /**
   * Upsert allows for add or update the new {@link Profile} into vscode settings.
   *
   * @param name {@link String} of the name of the profile
   * @param profile {@link Profile} object
   */
  async upsertProfile(name: string, profile: Profile): Promise<void> {
    this.sanitize(profile);
    const profileList = this.getAllProfiles();
    // Cannot mutate VSCode Config Object, create a clone and add that to settings.json
    const newProfileList = JSON.parse(JSON.stringify(profileList));
    newProfileList[name] = profile;
    await this.updateProfileSetting(newProfileList);
  }

  /**
   * Deletes a profile from the vscode settings.
   *
   * @param name {@link String} of the name of the profile
   */
  async deleteProfile(name: string): Promise<void> {
    const profileList = this.getAllProfiles();
    if (name in profileList) {
      // Cannot mutate VSCode Config Object, create a clone and add that to settings.json
      const newProfileList = JSON.parse(JSON.stringify(profileList));
      delete newProfileList[name];
      await this.updateProfileSetting(newProfileList);
      if (name === this.getActiveProfile()) {
        await this.updateActiveProfileSetting("");
      }
    }
  }

  /**
   * Validates if the {@link ProfileDetail} meets the requirements needed for authentication
   * and returns back the authentication type.
   *
   * The validation process calculates the authentication flow by what is detailed in the
   * {@link ProfileDetail}.  If the conditions to calculate the authentication flow are not
   * meet, then an error is provided in the {@link ProfileValidation}.
   *
   * @param profileDetail
   * @returns ProfileValidation object
   */
  async validateProfile(
    profileDetail?: ProfileDetail
  ): Promise<ProfileValidation> {
    const pv: ProfileValidation = {
      type: AuthType.Error,
      error: "",
      profile: <Profile>{},
    };
    //Validate active profile, return early if not valid
    if (!profileDetail.profile) {
      pv.error = "No Active Profile";
      return pv;
    }
    pv.profile = profileDetail.profile;
    if (profileDetail.profile["clientId"]) {
      pv.type = AuthType.Password;
    } else if (profileDetail.profile["tokenFile"]) {
      pv.type = AuthType.TokenFile;
      try {
        pv.data = readFileSync(profileDetail.profile["tokenFile"], "utf-8");
      } catch (err) {
        pv.error = `Please update profile (${profileDetail.name}): ${err.message}`;
        pv.type = AuthType.Error;
      }
    } else {
      pv.error = "No token or client found";
    }
    return pv;
  }

  /**
   * Requests users input on updating or adding a new profile.
   *
   * @param name the {@link String} represntation of the name of the profile
   * @param forceUpdate the {@link Boolean} of whether to prompt the user when value is already defined
   */
  async prompt(name: string, forceUpdate = false): Promise<void> {
    const profile = this.getProfileByName(name);
    // Cannot mutate VSCode Config Object, create a clone and upsert
    let profileClone = { ...profile };
    if (!profile) {
      profileClone = <Profile>{
        endpoint: "",
        clientId: "",
        clientSecret: "",
        context: "",
        username: "",
        tokenFile: "",
      };
    }

    if (!profileClone["endpoint"] || forceUpdate) {
      profileClone["endpoint"] = await createInputTextBox(
        ProfilePromptType.Endpoint,
        profileClone["endpoint"]
      );
    }
    if (!profileClone["context"] || forceUpdate) {
      profileClone["context"] = DEFAULT_COMPUTE_CONTEXT;
      profileClone["context"] = await createInputTextBox(
        ProfilePromptType.ComputeContext,
        profileClone["context"]
      );
    }
    if (!profileClone["clientId"] || !profileClone["tokenFile"] || forceUpdate) {
      profileClone["clientId"] = await createInputTextBox(
        ProfilePromptType.ClientId,
        profileClone["clientId"]
      );
    }
    if (
      (!profileClone["clientSecret"] ||
        !profileClone["tokenFile"] ||
        forceUpdate) &&
      profileClone["clientId"]
    ) {
      profileClone["clientSecret"] = await createInputTextBox(
        ProfilePromptType.ClientSecret,
        profileClone["clientSecret"]
      );
    }
    if ((!profileClone["tokenFile"] || forceUpdate) && !profileClone["clientId"]) {
      profileClone["tokenFile"] = await createInputTextBox(
        ProfilePromptType.TokenFile,
        profileClone["tokenFile"]
      );
    }
    // The username field will only appear for non-token files, and will only update if the user runs the update profile command
    if (
      (!profileClone["username"] || forceUpdate) &&
      profileClone["clientId"]
    ) {
      profileClone["username"] = await createInputTextBox(
        ProfilePromptType.Username,
        profileClone["username"]
      );
    }
    await this.upsertProfile(name, profileClone);
  }

  /**
   * Sanitize a {@link Profile} object that is passed by reference.
   *
   * @param profile {@link Profile} object
   */
  private sanitize(profile: Profile) {
    if (profile["clientId"]) {
      delete profile["tokenFile"];
    } else {
      delete profile["clientId"];
      delete profile["clientSecret"];
      delete profile["username"];
    }
  }
}

/**
 * Define an object to represent the values needed for prompting a window.showInputBox
 */
export interface ProfilePrompt {
  title: string;
  placeholder: string;
  description: string;
}

/**
 * An enum representing the types of prompts that can be returned for  window.showInputBox
 */
export enum ProfilePromptType {
  Profile = 0,
  NewProfile,
  ClientId,
  Endpoint,
  ComputeContext,
  ClientSecret,
  Username,
  Password,
  TokenFile,
}

/**
 * An interface that will map an enum of {@link ProfilePromptType} to an interface of {@link ProfilePrompt}.
 */
export type ProfilePromptInput = {
  [key in ProfilePromptType]: ProfilePrompt;
};

/**
 * Retrieves the {@link ProfilePrompt} by the enum {@link ProfilePromptType}
 *
 * @param type {@link ProfilePromptType}
 * @returns ProfilePrompt object
 */
export function getProfilePrompt(type: ProfilePromptType): ProfilePrompt {
  return input[type];
}

/**
 * Helper method to generate a window.ShowInputBox with using a defined set of {@link ProfilePrompt}s.
 *
 * @param profilePromptType {@link ProfilePromptType}
 * @param defaultValue the {@link String} of the default value that will be represented in the input box. Defaults to null
 * @param maskValue the {@link boolean} if the input value will be masked
 * @param username the {@link String} of the SAS User ID
 * @returns Thenable<{@link String}> of the users input
 */
export async function createInputTextBox(
  profilePromptType: ProfilePromptType,
  defaultValue: string | undefined = null,
  maskValue = false,
  username: string | undefined = null
): Promise<Thenable<string | undefined>> {
  const profilePrompt = getProfilePrompt(profilePromptType);
  let placeHolderText = profilePrompt.placeholder;
  let descriptionText = profilePrompt.description;
  if (profilePromptType === ProfilePromptType.Password) {
    placeHolderText += `${username}`;
    descriptionText += `${username}.`;
  }
  const entered = await window.showInputBox({
    title: profilePrompt.title,
    placeHolder: placeHolderText,
    prompt: descriptionText,
    password: maskValue,
    value: defaultValue,
    ignoreFocusOut: true,
  });
  return entered ?? defaultValue;
}

/**
 * Mapped {@link ProfilePrompt} to an enum of {@link ProfilePromptType}.
 */
const input: ProfilePromptInput = {
  [ProfilePromptType.Profile]: {
    title: "Switch Current SAS Profile",
    placeholder: "Select a SAS connection profile",
    description: "",
  },
  [ProfilePromptType.NewProfile]: {
    title: "New SAS Connection Profile Name",
    placeholder: "Enter connection name",
    description:
      "You can also specify connection profile using the settings.json file.",
  },
  [ProfilePromptType.Endpoint]: {
    title: "SAS Viya Server",
    placeholder: "Enter the URL",
    description:
      "Enter the URL for the SAS Viya server. An example is https://example.sas.com.",
  },
  [ProfilePromptType.ComputeContext]: {
    title: "SAS Compute Context",
    placeholder: "Enter the SAS compute context",
    description: "Enter the SAS compute context.",
  },
  [ProfilePromptType.ClientId]: {
    title: "Client ID",
    placeholder: "Enter a client ID",
    description:
      "Enter the registered client ID. An example is myapp.client. If using a token file, leave field blank.",
  },
  [ProfilePromptType.ClientSecret]: {
    title: "Client Secret",
    placeholder: "Enter a client secret",
    description: "Enter secret for client ID. An example is myapp.secret.",
  },
  [ProfilePromptType.Username]: {
    title: "SAS User ID",
    placeholder: "Enter your SAS User ID",
    description: "Enter your SAS User ID.",
  },
  [ProfilePromptType.Password]: {
    title: "SAS Password",
    placeholder: "Enter your SAS Password for the User ID ",
    description: "Enter your SAS Password for the User ID ",
  },
  [ProfilePromptType.TokenFile]: {
    title: "SAS Access Token",
    placeholder: "Enter the path to the SAS token file",
    description:
      "Enter the path for the local file that contains the SAS access token value. If using a client ID and client secret, leave field blank.",
  },
};
