// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ConfigurationTarget,
  QuickPickOptions,
  commands,
  l10n,
  window,
  workspace,
} from "vscode";

import { readFileSync } from "fs";

export const EXTENSION_CONFIG_KEY = "SAS";
export const EXTENSION_DEFINE_PROFILES_CONFIG_KEY = "connectionProfiles";
export const EXTENSION_PROFILES_CONFIG_KEY = "profiles";
export const EXTENSION_ACTIVE_PROFILE_CONFIG_KEY = "activeProfile";

enum ConnectionOptions {
  SASViya = "SAS Viya",
  SAS94Remote = "SAS 9.4 (remote - SSH)",
  SAS9IOM = "SAS 9.4 (remote - IOM)",
  SAS9COM = "SAS 9.4 (local)",
}

const CONNECTION_PICK_OPTS: string[] = [
  ConnectionOptions.SASViya,
  ConnectionOptions.SAS94Remote,
  ConnectionOptions.SAS9IOM,
  ConnectionOptions.SAS9COM,
];

/**
 * The default compute context that will be used to create a SAS session.
 */
export const DEFAULT_COMPUTE_CONTEXT = "SAS Job Execution compute context";
export const DEFAULT_SSH_PORT = "22";
export const DEFAULT_IOM_PORT = "8591";

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
  AuthCode = "authorization_code",
  Error = "error",
}

/**
 * Enum that represents the connection type for a profile.
 */
export enum ConnectionType {
  COM = "com",
  IOM = "iom",
  Rest = "rest",
  SSH = "ssh",
}

/**
 * Profile is an interface that represents a users profile.  Currently
 * supports two different authentication flows, token and password
 * flow with the clientId and clientSecret.
 *
 * Direct connect is also supported where a server is already started with
 * a static serverId. Setting serverId in the profile indicates that a connection
 * to that specific server with Id will be created. This overrides the context
 * value. Normally this option should not be set by the user since it is most likely
 * being set by an automated process.
 */
export interface ViyaProfile extends BaseProfile {
  connectionType: ConnectionType.Rest;
  endpoint: string;
  clientId?: string;
  clientSecret?: string;
  context?: string;
  serverId?: string;
}

export interface SSHProfile extends BaseProfile {
  connectionType: ConnectionType.SSH;
  host: string;
  saspath: string;
  port: number;
  username: string;
}

export interface COMProfile extends BaseProfile {
  connectionType: ConnectionType.COM;
  host: string;
}

export interface IOMProfile extends BaseProfile {
  connectionType: ConnectionType.IOM;
  host: string;
  username: string;
  port: number;
}

export type Profile = ViyaProfile | SSHProfile | COMProfile | IOMProfile;

export enum AutoExecType {
  File = "file",
  Line = "line",
}

export type AutoExec = AutoExecLine | AutoExecFile;

export interface AutoExecLine {
  type: AutoExecType.Line;
  line: string;
}

export interface AutoExecFile {
  type: AutoExecType.File;
  filePath: string;
}

export interface BaseProfile {
  sasOptions?: string[];
  autoExec?: AutoExec[];
}

export const toAutoExecLines = (autoExec: AutoExec[]): string[] => {
  const lines: string[] = [];

  for (const item of autoExec) {
    switch (item.type) {
      case AutoExecType.Line:
        lines.push(item.line);
        break;
      case AutoExecType.File:
        lines.push(...toAutoExecLinesFromPaths(item.filePath));
        break;
      default:
        break;
    }
  }
  return lines;
};

/**
 * Reads content from the given string paths.
 * Content is read sequentially from each path starting at the zeroth path,
 * appending each content line into the output array.
 *
 * If there is an error reading a file in the paths array, then
 * the file is skipped and content is not added.
 * @param paths string array of paths to read content from.
 * @returns string array of lines
 */
const toAutoExecLinesFromPaths = (filePath: string): string[] => {
  const lines: string[] = [];
  try {
    const content = readFileSync(filePath, "utf8").split(/\n|\r\n/);
    lines.push(...content);
  } catch (e) {
    const err: Error = e;
    console.warn(
      `Error reading file: ${filePath}, error: ${err.message}, skipping...`,
    );
  }
  return lines;
};

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
   * Helper function to migrate legacy profiles without a connection type.
   */
  async migrateLegacyProfiles() {
    const profiles = this.getAllProfiles();

    if (profiles) {
      for (const key in profiles) {
        const profile = profiles[key];
        if (profile.connectionType === undefined) {
          profile.connectionType = ConnectionType.Rest;
          await this.upsertProfile(key, profile);
        }
        if (
          profile.connectionType === ConnectionType.Rest &&
          /\/$/.test(profile.endpoint)
        ) {
          profile.endpoint = profile.endpoint.replace(/\/$/, "");
          await this.upsertProfile(key, profile);
        }
      }
    }
  }

  /**
   * Validates settings.json to confirm that SAS.connectionProfiles exists
   * as a key, and updates it, if the setting does not exists
   *
   * @returns Boolean for pass or fail
   */
  validateSettings(): boolean {
    const profileList: Dictionary<Profile> = workspace
      .getConfiguration(EXTENSION_CONFIG_KEY)
      .get(EXTENSION_DEFINE_PROFILES_CONFIG_KEY)[EXTENSION_PROFILES_CONFIG_KEY];

    if (!profileList) {
      workspace.getConfiguration(EXTENSION_CONFIG_KEY).update(
        EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
        {
          activeProfile: "",
          profiles: {},
        },
        ConfigurationTarget.Global,
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
        ConfigurationTarget.Global,
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
      commands.executeCommand("SAS.close", true);
    } else {
      profiles.activeProfile = "";
    }
    await workspace
      .getConfiguration(EXTENSION_CONFIG_KEY)
      .update(
        EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
        profiles,
        ConfigurationTarget.Global,
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
  getProfileByName<T extends Profile>(name: string): T {
    const profileList = this.getAllProfiles();
    if (name in profileList) {
      /* eslint-disable @typescript-eslint/consistent-type-assertions*/
      return profileList[name] as T;
    }
    return undefined;
  }

  /**
   * Retrieves the {@link ProfileDetail} of the active profile set in the profile
   * configurations.
   *
   * @returns Optional ProfileDetail
   */
  getActiveProfileDetail(): ProfileDetail | undefined {
    const activeProfileName = this.getActiveProfile();

    const profileList = this.getAllProfiles();
    if (activeProfileName in profileList) {
      const profile = { ...profileList[activeProfileName] };
      if (
        profile.connectionType === ConnectionType.Rest &&
        /\/$/.test(profile.endpoint)
      ) {
        profile.endpoint = profile.endpoint.replace(/\/$/, "");
      }
      const detail: ProfileDetail = {
        name: activeProfileName,
        profile,
      };
      return detail;
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
  validateProfile(profileDetail?: ProfileDetail): ProfileValidation {
    const pv: ProfileValidation = {
      type: AuthType.Error,
      error: "",
      profile: undefined,
    };

    //Validate active profile, return early if not valid
    if (!profileDetail?.profile) {
      pv.error = l10n.t("No Active Profile");
      return pv;
    }

    const profile: Profile = profileDetail.profile;
    if (profile.connectionType === undefined) {
      pv.error = l10n.t("Missing connectionType in active profile.");
      return pv;
    }
    if (profile.connectionType === ConnectionType.Rest) {
      if (!profile.endpoint) {
        pv.error = l10n.t("Missing endpoint in active profile.");
        return pv;
      }
    } else if (profile.connectionType === ConnectionType.SSH) {
      if (!profile.host) {
        pv.error = l10n.t("Missing host in active profile.");
        return pv;
      }

      if (!profile.port) {
        pv.error = l10n.t("Missing port in active profile.");
        return pv;
      }

      if (!profile.saspath) {
        pv.error = l10n.t("Missing sas path in active profile.");
        return pv;
      }
      if (!profile.username) {
        pv.error = l10n.t("Missing username in active profile.");
        return pv;
      }
    }

    pv.profile = profileDetail.profile;
    pv.type = AuthType.AuthCode;
    return pv;
  }

  /**
   * Requests users input on updating or adding a new profile.
   *
   * @param name the {@link String} representation of the name of the profile
   */
  async prompt(name: string): Promise<void> {
    const profile: Profile = this.getProfileByName(name);
    // Cannot mutate VSCode Config Object, create a clone and upsert
    let profileClone = { ...profile };
    if (!profile) {
      profileClone = {
        connectionType: ConnectionType.Rest,
        endpoint: undefined,
      };
    }

    const inputConnectionType: string = await createInputQuickPick(
      CONNECTION_PICK_OPTS,
      ProfilePromptType.ConnectionType,
    );
    if (inputConnectionType === undefined) {
      return;
    }

    profileClone.connectionType = mapQuickPickToEnum(inputConnectionType);

    if (profileClone.connectionType === ConnectionType.Rest) {
      profileClone.endpoint = await createInputTextBox(
        ProfilePromptType.Endpoint,
        profileClone.endpoint,
      );

      if (!profileClone.endpoint) {
        return;
      }
      profileClone.endpoint = profileClone.endpoint.replace(/\/$/, "");

      profileClone.context = await createInputTextBox(
        ProfilePromptType.ComputeContext,
        profileClone.context || DEFAULT_COMPUTE_CONTEXT,
      );
      if (profileClone.context === undefined) {
        return;
      }
      if (
        profileClone.context === "" ||
        profileClone.context === DEFAULT_COMPUTE_CONTEXT
      ) {
        delete profileClone.context;
      }

      profileClone.clientId = await createInputTextBox(
        ProfilePromptType.ClientId,
        profileClone.clientId,
      );
      if (profileClone.clientId === undefined) {
        return;
      }
      if (profileClone.clientId === "") {
        delete profileClone.clientId;
      }

      if (profileClone.clientId) {
        profileClone.clientSecret = await createInputTextBox(
          ProfilePromptType.ClientSecret,
          profileClone.clientSecret,
        );
        if (profileClone.clientSecret === undefined) {
          return;
        }
      }

      await this.upsertProfile(name, profileClone);
    } else if (profileClone.connectionType === ConnectionType.SSH) {
      profileClone.host = await createInputTextBox(
        ProfilePromptType.Host,
        profileClone.host,
      );
      if (!profileClone.host) {
        return;
      }

      profileClone.saspath = await createInputTextBox(
        ProfilePromptType.SASPath,
        profileClone.saspath,
      );
      if (profileClone.saspath === undefined) {
        return;
      }

      profileClone.username = await createInputTextBox(
        ProfilePromptType.Username,
        profileClone.username,
      );
      if (profileClone.username === undefined) {
        return;
      }

      profileClone.port = parseInt(
        await createInputTextBox(ProfilePromptType.Port, DEFAULT_SSH_PORT),
      );
      if (isNaN(profileClone.port)) {
        return;
      }

      await this.upsertProfile(name, profileClone);
    } else if (profileClone.connectionType === ConnectionType.COM) {
      profileClone.sasOptions = [];
      profileClone.host = "localhost"; //once remote support rolls out this should be set via prompting
      await this.upsertProfile(name, profileClone);
    } else if (profileClone.connectionType === ConnectionType.IOM) {
      profileClone.sasOptions = [];
      profileClone.host = await createInputTextBox(
        ProfilePromptType.Host,
        profileClone.host,
      );
      if (!profileClone.host) {
        return;
      }

      profileClone.port = parseInt(
        await createInputTextBox(ProfilePromptType.Port, DEFAULT_IOM_PORT),
      );
      if (isNaN(profileClone.port)) {
        return;
      }

      profileClone.username = await createInputTextBox(
        ProfilePromptType.Username,
        profileClone.username,
      );
      if (profileClone.username === undefined) {
        return;
      }

      await this.upsertProfile(name, profileClone);
    }
  }

  /**
   * Retrieves the remote target associated with the active profile. For SSH profiles, the host
   * value is used. For Viya, the endpoint value is used.
   * @param profileName - a profile name to retrieve.
   * @returns
   */
  remoteTarget(profileName: string): string {
    const activeProfile = this.getProfileByName(profileName);
    switch (activeProfile.connectionType) {
      case ConnectionType.SSH:
      case ConnectionType.COM:
      case ConnectionType.IOM:
        return activeProfile.host;
      case ConnectionType.Rest:
        return activeProfile.endpoint;
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
  ConnectionType,
  Host,
  SASPath,
  Port,
  Username,
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
): Promise<string> {
  const profilePrompt = getProfilePrompt(profilePromptType);

  const entered = await window.showInputBox({
    title: profilePrompt.title,
    placeHolder: profilePrompt.placeholder,
    prompt: profilePrompt.description,
    password: maskValue,
    value: defaultValue,
    ignoreFocusOut: true,
  });
  return entered;
}

/**
 * Helper method to generate a window.ShowInputQuickPick using a defined set of {@link ProfilePrompt}s.
 * @param items list of selectable options to bind to the quickpick.
 * @param profilePromptType {@link ProfilePromptType}
 * @returns Thenable<{@link String}> of the users input
 */
export async function createInputQuickPick(
  items: readonly string[] | Thenable<readonly string[]> = [],
  profilePromptType: ProfilePromptType,
): Promise<string> {
  const profilePrompt = getProfilePrompt(profilePromptType);

  const options: QuickPickOptions = {
    title: profilePrompt.title,
    placeHolder: profilePrompt.placeholder,
    ignoreFocusOut: true,
    canPickMany: false,
  };

  const entered = await window.showQuickPick(items, options);

  return entered;
}

/**
 * Mapped {@link ProfilePrompt} to an enum of {@link ProfilePromptType}.
 */
const input: ProfilePromptInput = {
  [ProfilePromptType.Profile]: {
    title: l10n.t("Switch Current SAS Profile"),
    placeholder: l10n.t("Select a SAS connection profile"),
    description: "",
  },
  [ProfilePromptType.NewProfile]: {
    title: l10n.t("New SAS Connection Profile Name"),
    placeholder: l10n.t("Enter connection name"),
    description: l10n.t(
      "You can also specify connection profile using the settings.json file.",
    ),
  },
  [ProfilePromptType.Endpoint]: {
    title: l10n.t("SAS Viya Server"),
    placeholder: l10n.t("Enter the URL"),
    description: l10n.t(
      "Enter the URL for the SAS Viya server. An example is https://example.sas.com.",
    ),
  },
  [ProfilePromptType.ComputeContext]: {
    title: l10n.t("SAS Compute Context"),
    placeholder: l10n.t("Enter the SAS compute context"),
    description: l10n.t("Enter the SAS compute context."),
  },
  [ProfilePromptType.ClientId]: {
    title: l10n.t("Client ID"),
    placeholder: l10n.t("Enter a client ID"),
    description: l10n.t(
      "Enter the registered client ID. An example is myapp.client.",
    ),
  },
  [ProfilePromptType.ClientSecret]: {
    title: l10n.t("Client Secret"),
    placeholder: l10n.t("Enter a client secret"),
    description: l10n.t(
      "Enter secret for client ID. An example is myapp.secret.",
    ),
  },
  [ProfilePromptType.ConnectionType]: {
    title: l10n.t("Connection Type"),
    placeholder: l10n.t("Select a Connection Type"),
    description: l10n.t("Select a Connection Type."),
  },
  [ProfilePromptType.Host]: {
    title: l10n.t("SAS 9 SSH Server"),
    placeholder: l10n.t("Enter the server name"),
    description: l10n.t("Enter the name of the SAS 9 SSH server."),
  },
  [ProfilePromptType.SASPath]: {
    title: l10n.t("Server Path"),
    placeholder: l10n.t("Enter the server path"),
    description: l10n.t("Enter the server path of the SAS Executable."),
  },
  [ProfilePromptType.Port]: {
    title: l10n.t("Port Number"),
    placeholder: l10n.t("Enter a port number"),
    description: l10n.t("Enter a port number."),
  },
  [ProfilePromptType.Username]: {
    title: l10n.t("SAS Server Username"),
    placeholder: l10n.t("Enter your username"),
    description: l10n.t("Enter your SAS server username."),
  },
};

/**
 * Helper function to map the quick pick item selection to a well known {@link ConnectionType}.
 * @param connectionTypePickInput - string value of one of the quick pick option inputs
 * @returns {@link ConnectionType}
 */
function mapQuickPickToEnum(connectionTypePickInput: string): ConnectionType {
  /*
     Having a translation layer here allows the profile types to potentially evolve separately from the
     underlying technology used to implement the connection. Down the road its quite possible to have
     more than one selectable quick pick input that uses the same underlying connection methods..
  */
  switch (connectionTypePickInput) {
    case ConnectionOptions.SASViya:
      return ConnectionType.Rest;
    case ConnectionOptions.SAS94Remote:
      return ConnectionType.SSH;
    case ConnectionOptions.SAS9COM:
    case ConnectionOptions.SAS9IOM:
      return ConnectionType.IOM;
    default:
      return undefined;
  }
}
