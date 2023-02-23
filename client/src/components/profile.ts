// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  commands,
  window,
  workspace,
  ConfigurationTarget,
  QuickPickOptions,
} from "vscode";

export const EXTENSION_CONFIG_KEY = "SAS";
export const EXTENSION_DEFINE_PROFILES_CONFIG_KEY = "connectionProfiles";
export const EXTENSION_PROFILES_CONFIG_KEY = "profiles";
export const EXTENSION_ACTIVE_PROFILE_CONFIG_KEY = "activeProfile";

enum ConnectionOptions {
  SASViya = "SAS Viya",
  SAS94Remote = "SAS 9.4 (remote)",
}

const CONNECTION_PICK_OPTS: string[] = [
  ConnectionOptions.SASViya,
  ConnectionOptions.SAS94Remote,
];

/**
 * The default compute context that will be used to create a SAS session.
 */
export const DEFAULT_COMPUTE_CONTEXT = "SAS Job Execution compute context";
export const DEFAULT_SSH_PORT = "22";

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
  Rest = "rest",
  SSH = "ssh",
}

export interface Profile {
  connectionType: ConnectionType;
}
/**
 * Profile is an interface that represents a users profile.  Currently
 * supports two different authentication flows, token and password
 * flow with the clientId and clientSecret.
 */
export interface ViyaProfile extends Profile {
  endpoint: string;
  clientId?: string;
  clientSecret?: string;
  context?: string;
}

export interface SSHProfile extends Profile {
  host: string;
  saspath: string;
  port: number;
  username: string;
  privateKeyPath: string;
  sasOptions: string[];
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
      commands.executeCommand("SAS.close", true);
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
  getActiveProfileDetail(): ProfileDetail | undefined {
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
      profile: <Profile>{},
    };

    //Validate active profile, return early if not valid
    if (!profileDetail?.profile) {
      pv.error = "No Active Profile";
      return pv;
    }

    if (profileDetail.profile.connectionType === ConnectionType.Rest) {
      const viyaProfile: ViyaProfile = <ViyaProfile>profileDetail.profile;

      if (!viyaProfile.endpoint) {
        pv.error = "Missing endpoint in active profile.";
        return pv;
      }
    } else if (profileDetail.profile.connectionType === ConnectionType.SSH) {
      const sshProfile: SSHProfile = profileDetail.profile as SSHProfile;

      if (!sshProfile.host) {
        pv.error = "Missing host in active profile.";
        return pv;
      }

      if (!sshProfile.port) {
        pv.error = "Missing port in active profile.";
        return pv;
      }

      if (!sshProfile.privateKeyPath) {
        pv.error = "Missing private key file in active profile.";
        return pv;
      }
      if (!sshProfile.saspath) {
        pv.error = "Missing sas path in active profile.";
        return pv;
      }
      if (!sshProfile.username) {
        pv.error = "Missing username in active profile.";
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
   * @param name the {@link String} represntation of the name of the profile
   */
  async prompt(name: string): Promise<void> {
    const profile = this.getProfileByName(name);
    // Cannot mutate VSCode Config Object, create a clone and upsert
    let profileClone: Profile = { ...profile };
    if (!profile) {
      profileClone = <Profile>{
        connectionType: undefined,
      };
    }

    const inputConnectionType: string = await createInputQuickPick(
      CONNECTION_PICK_OPTS,
      ProfilePromptType.ConnectionType
    );

    profileClone.connectionType = mapQuickPickToEnum(inputConnectionType);

    if (profileClone.connectionType === ConnectionType.Rest) {
      const viyaProfileClone = profileClone as ViyaProfile;
      viyaProfileClone.endpoint = await createInputTextBox(
        ProfilePromptType.Endpoint,
        viyaProfileClone.endpoint
      );

      if (!viyaProfileClone.endpoint) {
        return;
      }

      viyaProfileClone.context = await createInputTextBox(
        ProfilePromptType.ComputeContext,
        viyaProfileClone.context || DEFAULT_COMPUTE_CONTEXT
      );
      if (
        viyaProfileClone.context === "" ||
        viyaProfileClone.context === DEFAULT_COMPUTE_CONTEXT
      ) {
        delete viyaProfileClone.context;
      }

      viyaProfileClone.clientId = await createInputTextBox(
        ProfilePromptType.ClientId,
        viyaProfileClone.clientId
      );
      if (viyaProfileClone.clientId === "") {
        delete viyaProfileClone.clientId;
      }

      if (viyaProfileClone.clientId) {
        viyaProfileClone.clientSecret = await createInputTextBox(
          ProfilePromptType.ClientSecret,
          viyaProfileClone.clientSecret
        );
      }

      await this.upsertProfile(name, viyaProfileClone);
    } else if (profileClone.connectionType === ConnectionType.SSH) {
      const newProfileClone: SSHProfile = profileClone as SSHProfile;
      newProfileClone.host = await createInputTextBox(
        ProfilePromptType.Host,
        newProfileClone.host
      );

      newProfileClone.saspath = await createInputTextBox(
        ProfilePromptType.SASPath,
        newProfileClone.saspath
      );

      newProfileClone.username = await createInputTextBox(
        ProfilePromptType.Username,
        newProfileClone.username
      );

      newProfileClone.port = +(await createInputTextBox(
        ProfilePromptType.Port,
        DEFAULT_SSH_PORT
      ));

      newProfileClone.privateKeyPath = await createInputTextBox(
        ProfilePromptType.PrivateKeyPath,
        newProfileClone.privateKeyPath
      );
      await this.upsertProfile(name, newProfileClone);
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
        return (<SSHProfile>activeProfile).host;
      case ConnectionType.Rest:
        return (<ViyaProfile>activeProfile).endpoint;
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
  PrivateKeyPath,
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
  maskValue = false
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
  profilePromptType: ProfilePromptType
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
    description: "Enter the registered client ID. An example is myapp.client.",
  },
  [ProfilePromptType.ClientSecret]: {
    title: "Client Secret",
    placeholder: "Enter a client secret",
    description: "Enter secret for client ID. An example is myapp.secret.",
  },
  [ProfilePromptType.ConnectionType]: {
    title: "Connection Type",
    placeholder: "Select a Connection Type",
    description: "Select a Connection Type",
  },
  [ProfilePromptType.Host]: {
    title: "Host",
    placeholder: "Enter a Host",
    description: "Enter a Host",
  },
  [ProfilePromptType.SASPath]: {
    title: "SAS Path Executable",
    placeholder: "Enter the server path of a SAS Executable",
    description: "Enter the server path of a SAS Executable",
  },
  [ProfilePromptType.Port]: {
    title: "Port",
    placeholder: "Enter a Port Number",
    description: "Enter a Port Number",
  },
  [ProfilePromptType.Username]: {
    title: "Username",
    placeholder: "Enter a Username",
    description: "Enter a Username",
  },
  [ProfilePromptType.PrivateKeyPath]: {
    title: "Private Key File",
    placeholder: "Enter a local path to a Private Key File",
    description: "Enter a local path to a Private Key File",
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
    default:
      return undefined;
  }
}
