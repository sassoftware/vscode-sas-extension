import { Dictionary } from '../utils/dictionary';
import { ConfigFile } from '../utils/configFile'
import { createInputTextBox, NEW_PROFILE_TITLE, NEW_PROFILE_PLACEHOLDER } from '../utils/userInput';

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
export const NEW_CONFIG_FILE_PLACEHOLDER = 'Enter Config File Location...';
const DEFAULT_COMPUTE_CONTEXT = 'SAS Job Execution compute context';


export interface Profile {
  'sas-endpoint': string;
  'client-id': string;
  'client-secret': string;
  'compute-context': string;
  'user'?: string;
  'active'?: boolean;
}

export interface ProfileDetail {
  'name': string;
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
      'client-id': '',
      'client-secret': '',
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
    if(profileList.length === 0 ){
      const newProfile = await createInputTextBox(NEW_PROFILE_PLACEHOLDER, NEW_PROFILE_TITLE);
      await this.prompt(newProfile);
    }
    await this.update(profileList);
  }

  async prompt(name: string, setDefault = true): Promise<void> {
    const profile = name in this.value ? this.value[name] : <Profile>{ "sas-endpoint": "", "client-id": "", "client-secret": "", "compute-context": "", "active": false }

    if (!profile['sas-endpoint'] || setDefault) {
      profile['sas-endpoint'] = await createInputTextBox(NEW_HOSTNAME_PLACEHOLDER, NEW_HOSTNAME_TITLE, profile['sas-endpoint']);
    }
    if (!profile['client-id'] || setDefault) {
      profile['client-id'] = await createInputTextBox(CLIENT_ID_PLACEHOLDER, CLIENT_ID_TITLE, profile['client-id']);
    }
    if (!profile['client-secret'] || setDefault) {
      profile['client-secret'] = await createInputTextBox(CLIENT_SECRET_PLACEHOLDER, CLIENT_SECRET_TITLE, profile['client-secret']);
    }
    if (!profile['compute-context'] || setDefault) {
      profile['compute-context'] = await createInputTextBox(COMPUTE_CONTEXT_PLACEHOLDER, COMPUTE_CONTEXT_TITLE, profile['compute-context'] || DEFAULT_COMPUTE_CONTEXT);
    }
    this.upsertProfile(name, profile);
    // If you are prompted, go ahead setActive
    
    this.setActiveProfile(name);
  }
}