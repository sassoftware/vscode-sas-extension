import { readFileSync, writeFileSync, existsSync } from "fs";
import { window } from 'vscode';


/**
 * The default compute context that will be used to create a SAS session.
 */
const DEFAULT_COMPUTE_CONTEXT = 'SAS Job Execution compute context';


/**
 * Dictionary is a type that maps a generic object with a string key.
 */
type Dictionary<T> = {
  [key: string]: T;
};


/**
 * ConfigFile is a configuration file manager that supports marshaling
 * a generic interface.
 */
class ConfigFile<T> {
  protected value: T | undefined;

  constructor(
    private readonly filename: string,
    private readonly defaultValue: () => T) {
    this.getSync();
  }

  /**
   * Retreives the configuration {@link T}
   * 
   * @param reload {@link Boolean} reloads file before returning {@link T}
   * @returns Promise<T>
   */
  async get(reload = false): Promise<T> {
    return this.getSync(reload);
  }

  /**
   * Synchronous get with optional reload if value is already set 
   * @param reload {@link Boolean} reloading configuration file
   * @returns T
   */
  getSync(reload = false): T {
    if (this.value && !reload) {
      return this.value;
    }

    // if file exists, parse and set value
    if (existsSync(this.filename)) {
      const text = readFileSync(this.filename, 'utf-8');
      this.value = JSON.parse(text);
      return this.value;
    }

    // if file does not exist, set default and 
    // update, which in turn creates the file.
    this.updateSync(this.defaultValue());
    return this.value;
  }

  /**
   * Marshal's configuration file based on the T value
   * @param value 
   */
  async update(value: T): Promise<void> {
    this.updateSync(value);
  }

  /**
  * Marshal's configuration file based on the T value
  * @param value
  */
  updateSync(value: T): void {
    this.value = value;
    const text = JSON.stringify(this.value, undefined, 2);
    writeFileSync(this.filename, text);
  }
}

/**
 * Enum that represents the authentication type for a profile.
 */
export enum AuthType {
  TokenFile = 'token-file',
  Password = 'password',
  Error = 'error'
}

/**
 * Profile is an interface that represents a users profile.  Currently
 * supports two different authentication flows, token-file and password
 * flow with the client-id and client-secret.
 */
export interface Profile {
  'sas-endpoint': string;
  'client-id'?: string;
  'client-secret'?: string;
  'compute-context': string;
  'token-file'?: string;
  'active'?: boolean;
}

/**
 * Profile detail is an interface that encapsulates the name of the profile
 * with the {@link Profile}.
 */
export interface ProfileDetail {
  'name': string;
  'profile': Profile;
}

/**
 * Profile validation is an interface that represents the validation
 * information from a profile needed when making a SAS connection.
 */
export interface ProfileValidation {
  'type': AuthType;
  'error': string;
  'data'?: string;
  'profile': Profile;
}

/**
 * ProfileConfig extends {@link ConfigFile} to manage a configuration file
 * of {@link Profile}s.  Profiles are designed to keep track of multiple
 * configurations of SAS Connections.
 */
export class ProfileConfig extends ConfigFile<Dictionary<Profile>> {
  constructor(fn: string, df: () => Dictionary<Profile>) {
    super(fn, df);
  }

  async length(): Promise<number> {
    return Object.keys(this.value).length;
  }

  /**
   * Retreives the list of profile names.
   * 
   * @returns List of profile names
   */
  async listProfile(): Promise<string[]> {
    return Object.keys(this.value);
  }

  /**
   * Retrieves the {@link ProfileDetail} of the active profile set in the profile
   * configurations.
   * 
   * @returns Optional ProfileDetail
   */
  async getActiveProfile(): Promise<ProfileDetail | undefined> {
    await this.get(true);
    const profileList = this.value;
    const active = Object.keys(profileList).find(function (name) {
      return name in profileList && 'active' in profileList[name] && profileList[name]['active'];
    });
    if (!active) return undefined;
    return <ProfileDetail>{ name: active, profile: profileList[active] };
  }

  /**
   * Retrieves the {@link Profile} by name from the profile configuration.  If the profile
   * is not found by name, a default {@link Profile} will be generated and returned.
   * 
   * @param name {@link String} of the profile name
   * @returns Profile object
   */
  async getProfileByName(name: string): Promise<Profile> {
    let profile: Profile = {
      'sas-endpoint': '',
      'compute-context': '',
      'active': false,
    }
    if (name in this.value) {
      profile = this.value[name];
    }
    return profile;
  }


  /**
   * Sets the active profile by profile name in the profile configuration.
   * 
   * Updates the profile configuration by enabling active on a specific profile and
   * disabling active on all other profiles.  Once updated, the updated configuration
   * will be marshaled.
   * 
   * @param name {@link String} of the name of the profile
   */
  async setActiveProfile(name: string): Promise<void> {
    const profileList = this.value;
    Object.keys(profileList).forEach(function (key) {
      profileList[key]['active'] = name === key;
    });
    await this.update(profileList);
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
  async validateProfile(profileDetail?: ProfileDetail): Promise<ProfileValidation> {
    const pv: ProfileValidation = {
      type: AuthType.Error,
      error: '',
      profile: <Profile>{}
    }
    //Validate active profile, return early if not valid
    if (!profileDetail.profile) {
      pv.error = "No Active Profile";
      return pv;
    }
    pv.profile = profileDetail.profile;
    if (profileDetail.profile['token-file']) {
      pv.type = AuthType.TokenFile;
      try {
        pv.data = readFileSync(profileDetail.profile['token-file'], 'utf-8');
      } catch (err) {
        pv.error = `Please update profile (${profileDetail.name}): ${err.message}`;
        pv.type = AuthType.Error;
      }
    } else if (profileDetail.profile['client-id']) {
      pv.type = AuthType.Password;
    } else {
      pv.error = "No token or client found";
    }
    return pv;
  }

  /**
   * Upsert allows for add or update the new {@link Profile} into the current profile confiugration.
   * 
   * @param name {@link String} of the name of the profile
   * @param profile {@link Profile} object
   */
  async upsertProfile(name: string, profile: Profile): Promise<void> {
    this.sanitize(profile);
    this.value[name] = profile;
    await this.update(this.value);
  }

  /**
   * Deletes a profile from the profile configuration.
   * 
   * @param name {@link String} of the name of the profile
   */
  async deleteProfile(name: string): Promise<void> {
    if (name in this.value) {
      if (this.value[name]['active']) {
        this.updateActiveProfile();
      }
      delete this.value[name];
      await this.update(this.value);
    }
  }

  /**
   * Updates the current active profile in the profile configuration by prompting
   * the user for updated information.  The user prompts will provide the current
   * object values to allow the user override any values needed to change.
   */
  async updateActiveProfile(): Promise<void> {
    const profileList = this.value;
    if (await this.length() === 0) {
      const newProfile = await createInputTextBox(ProfilePromptType.NewProfile);
      await this.prompt(newProfile);
    }
    await this.update(profileList);
  }

  /**
   * Requests users input on updating or adding a new profile.
   * 
   * @param name the {@link String} represntation of the name of the profile
   * @param forceUpdate the {@link Boolean} of whether to prompt the user when value is already defined
   */
  async prompt(name: string, forceUpdate = false): Promise<void> {
    const profile = name in this.value ? this.value[name] : <Profile>{ "sas-endpoint": "", "client-id": "", "client-secret": "", "compute-context": "", "active": false }

    if (!profile['sas-endpoint'] || forceUpdate) {
      profile['sas-endpoint'] = await createInputTextBox(ProfilePromptType.HostName, profile['sas-endpoint']);
    }
    if (!profile['compute-context'] || forceUpdate) {
      profile['compute-context'] = DEFAULT_COMPUTE_CONTEXT;
      profile['compute-context'] = await createInputTextBox(ProfilePromptType.ComputeContext, profile['compute-context']);
    }
    if ((!profile['client-id'] || !profile['token-file']) || forceUpdate) {
      profile['client-id'] = await createInputTextBox(ProfilePromptType.ClientId, profile['client-id']);
    }
    if ((!profile['client-secret'] || !profile['token-file']) || forceUpdate) {
      profile['client-secret'] = await createInputTextBox(ProfilePromptType.ClientSecret, profile['client-secret']);
    }
    if ((!profile['token-file'] || forceUpdate) && !profile['client-id']) {
      profile['token-file'] = await createInputTextBox(ProfilePromptType.TokenFile, profile['token-file']);
    }
    this.upsertProfile(name, profile);
    this.setActiveProfile(name);
  }

  /**
   * Sanitize a {@link Profile} object that is passed by reference.
   *
   * @param profile {@link Profile} object
   */
  private sanitize(profile: Profile) {
    if (profile['client-id']) {
      delete profile['token-file'];
    } else {
      delete profile['client-id'];
      delete profile['client-secret'];
    }
  }
}

/**
 * Define an object to represent the values needed for prompting a window.showInputBox
 */
export interface ProfilePrompt {
  title: string;
  placeholder: string;
}

/**
 * An enum representing the types of prompts that can be returned for  window.showInputBox
 */
export enum ProfilePromptType {
  Profile = 0,
  NewProfile,
  ClientId,
  HostName,
  UpdateHostname,
  ComputeContext,
  ClientSecret,
  Username,
  Password,
  ConfigFile,
  TokenFile
}

/**
 * An interface that will map an enum of {@link ProfilePromptType} to an interface of {@link ProfilePrompt}.
 */
export type ProfilePromptInput = {
  [key in ProfilePromptType]: ProfilePrompt;
}

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
 * @returns Thenable<{@link String}> of the users input
 */
export async function createInputTextBox(profilePromptType: ProfilePromptType, defaultValue: string | undefined = null, maskValue = false): Promise<Thenable<string | undefined>> {
  const profilePrompt = getProfilePrompt(profilePromptType);
  return window.showInputBox({
    title: profilePrompt.title,
    placeHolder: profilePrompt.placeholder,
    password: maskValue,
    value: defaultValue,
    ignoreFocusOut: true
  });
}

/**
 * Mapped {@link ProfilePrompt} to an enum of {@link ProfilePromptType}. 
 */
const input: ProfilePromptInput = {
  [ProfilePromptType.Profile]: { title: "Select a profile", placeholder: "Select Profile Name..." },
  [ProfilePromptType.NewProfile]: { title: "Please enter new profile name", placeholder: "Enter New Profile Name..." },
  [ProfilePromptType.HostName]: { title: "Hostname for new profile (e.g. https://example.sas.com)", placeholder: "Enter hostname..." },
  [ProfilePromptType.UpdateHostname]: { title: "Hostname for profile", placeholder: "Enter hostname..." },
  [ProfilePromptType.ComputeContext]: { title: "Compute Context", placeholder: "Enter Compute Context..." },
  [ProfilePromptType.ClientId]: { title: "Client ID", placeholder: "Enter New Client ID..." },
  [ProfilePromptType.ClientSecret]: { title: "Client Secret", placeholder: "Enter Client Secret..." },
  [ProfilePromptType.Username]: { title: "SAS Username", placeholder: "Enter a SAS Username..." },
  [ProfilePromptType.Password]: { title: "SAS Password", placeholder: "Enter a SAS Password..." },
  [ProfilePromptType.ConfigFile]: { title: "SAS Profile Config Path", placeholder: "Enter Config File Path..." },
  [ProfilePromptType.TokenFile]: { title: "SAS Token File Path", placeholder: "Enter Token File Path..." }
}
