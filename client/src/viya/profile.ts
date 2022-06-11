import { Dictionary } from '../utils/dictionary';
import { ConfigFile } from '../utils/configFile'
import { createInputTextBox, ProfilePromptType } from '../utils/userInput';
import { readFileSync } from "fs";

/**
 * The default compute context that will be used to create a SAS session.
 */
const DEFAULT_COMPUTE_CONTEXT = 'SAS Job Execution compute context';

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
      profile['client-secret'] = await createInputTextBox(ProfilePromptType.ClientId, profile['client-secret']);
    }
    if ((!profile['token-file'] || forceUpdate) && !profile['client-id']) {
      profile['token-file'] = await createInputTextBox(ProfilePromptType.TokenFile, profile['token-file']);
    }
    if (profile['client-id']) {
      delete profile['token-file'];
    } else {
      delete profile['client-id'];
      delete profile['client-secret'];
    }

    this.upsertProfile(name, profile);
    this.setActiveProfile(name);
  }
}