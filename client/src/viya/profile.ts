import { Dictionary } from '../utils/dictionary';
import { ConfigFile } from '../utils/configFile'
import { createInputTextBox, NEW_PROFILE_TITLE, NEW_PROFILE_PLACEHOLDER } from '../utils/userInput';
import { readFileSync } from "fs";

export const NEW_HOSTNAME_TITLE = 'Hostname for new profile (e.g. https://daily.plover-m1.unx.sas.com)';
export const NEW_HOSTNAME_PLACEHOLDER = 'Enter hostname...';
export const UPDATE_HOSTNAME_TITLE = 'Hostname for profile';
export const UPDATE_HOSTNAME_PLACEHOLDER = 'Enter hostname...';
export const CLIENT_ID_TITLE = 'Client ID';
export const CLIENT_ID_PLACEHOLDER = 'Enter Client ID...';
export const CLIENT_SECRET_TITLE = 'Client Secret';
export const CLIENT_SECRET_PLACEHOLDER = 'Enter Client Secret...';
export const COMPUTE_CONTEXT_TITLE = 'Compute Context';
export const COMPUTE_CONTEXT_PLACEHOLDER = 'Enter Compute Context...';
export const USERNAME_TITLE = 'SAS Username';
export const USERNAME_PLACEHOLDER = 'Enter a SAS Username...';
export const NEW_CONFIG_FILE_TITLE = 'SAS Profile Config Path';
export const NEW_CONFIG_FILE_PLACEHOLDER = 'Enter Config File Path...';
export const TOKEN_FILE_TITLE = 'SAS Token File Path'
export const TOKEN_FILE_PLACEHOLDER = 'Enter Token File Path...';
const DEFAULT_COMPUTE_CONTEXT = 'SAS Job Execution compute context';

export const VALIDATION_PROFILE_TOKEN = 'token-file';
export const VALIDATION_PROFILE_PASSWORD = 'password';

export enum ProfileType {
  TokenFile = 'token-file',
  Password = 'password',
  Error = 'error'
}

export interface Profile {
  'sas-endpoint': string;
  'client-id'?: string;
  'client-secret'?: string;
  'compute-context': string;
  'token-file'?: string;
  'active'?: boolean;
}

export interface ProfileDetail {
  'name': string;
  'profile': Profile;
}

export interface ProfileValidation {
  'type': ProfileType;
  'error': string;
  'data'?: string;
  'profile': Profile;
}

export class ProfileConfig extends ConfigFile<Dictionary<Profile>> {
  constructor(fn: string, df: () => Dictionary<Profile>) {
    super(fn, df);
  }

  async length(): Promise<number> {
    return Object.keys(this.value).length;
  }

  async listProfile(): Promise<string[]> {
    return Object.keys(this.value);
  }

  async getActiveProfile(): Promise<ProfileDetail | undefined> {
    await this.get(true);
    const profileList = this.value;
    const active = Object.keys(profileList).find(function (name) {
      return name in profileList && 'active' in profileList[name] && profileList[name]['active'];
    });
    if(!active) return undefined;
    return <ProfileDetail>{ name: active, profile: profileList[active] };
  }

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

  async setActiveProfile(name: string): Promise<void> {
    const profileList = this.value;
    Object.keys(profileList).forEach(function (key) {
      profileList[key]['active'] = name === key;
    });
    await this.update(profileList);
  }

  async validateProfile(profileDetail?: ProfileDetail): Promise<ProfileValidation> {
    const pv: ProfileValidation = {
      type: ProfileType.Error,
      error: '',
      profile: <Profile>{}
    }
    //Validate active profile, return early if not valid
    if(!profileDetail.profile){
      pv.error = "No Active Profile";
      return pv;
    }
    pv.profile = profileDetail.profile;
    if(profileDetail.profile['token-file']){
      pv.type = ProfileType.TokenFile;
      try {
        pv.data = readFileSync(profileDetail.profile['token-file'], 'utf-8');
      } catch (err) {
        pv.error = `Please update profile (${profileDetail.name}): ${err.message}`;
        pv.type = ProfileType.Error;
      }
    } else if(profileDetail.profile['client-id']){
      pv.type = ProfileType.Password;
    } else{
      pv.error = "No token or client found";
    }
    return pv;
  }

  async upsertProfile(name: string, profile: Profile): Promise<void> {
    this.value[name] = profile;
    await this.update(this.value);
  }

  async deleteProfile(name: string): Promise<void> {
    if (name in this.value) {
      if(this.value[name]['active']){
        this.updateActiveProfile();
      }
      delete this.value[name];
      await this.update(this.value);
    }
  }

  async updateActiveProfile(): Promise<void> {
    const profileList = this.value;
    if(await this.length() === 0){
      const newProfile = await createInputTextBox(NEW_PROFILE_PLACEHOLDER, NEW_PROFILE_TITLE);
      await this.prompt(newProfile);
    }
    await this.update(profileList);
  }

  async prompt(name: string, forceUpdate=false): Promise<void> {
    const profile = name in this.value ? this.value[name] : <Profile>{ "sas-endpoint": "", "client-id": "", "client-secret": "", "compute-context": "", "active": false }

    if (!profile['sas-endpoint'] || forceUpdate) {
      profile['sas-endpoint'] = await createInputTextBox(NEW_HOSTNAME_PLACEHOLDER, NEW_HOSTNAME_TITLE, profile['sas-endpoint']);
    }
    if (!profile['compute-context'] || forceUpdate) {
      profile['compute-context'] = DEFAULT_COMPUTE_CONTEXT;
      profile['compute-context'] = await createInputTextBox(COMPUTE_CONTEXT_PLACEHOLDER, COMPUTE_CONTEXT_TITLE, profile['compute-context']);
    }
    if ((!profile['client-id'] || !profile['token-file']) || forceUpdate) {
      profile['client-id'] = await createInputTextBox(CLIENT_ID_PLACEHOLDER, CLIENT_ID_TITLE, profile['client-id']);
    }
    if ((!profile['client-secret'] || !profile['token-file']) || forceUpdate) {
      profile['client-secret'] = await createInputTextBox(CLIENT_SECRET_PLACEHOLDER, CLIENT_SECRET_TITLE, profile['client-secret']);
    }
    if ((!profile['token-file'] || forceUpdate) && !profile['client-id']) {
      profile['token-file'] = await createInputTextBox(TOKEN_FILE_PLACEHOLDER, TOKEN_FILE_TITLE, profile['token-file']);
    }
    if(profile['client-id']) {
      delete profile['token-file'];
    } else {
      delete profile['client-id'];
      delete profile['client-secret'];
    } 

    this.upsertProfile(name, profile);
    // If you are prompted, set as active profile
    this.setActiveProfile(name);
  }
}