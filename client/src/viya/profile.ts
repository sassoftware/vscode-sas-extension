import { Dictionary } from '../utils/dictionary';
import { ConfigFile } from '../utils/configFile'
import { window } from 'vscode';
import { profile } from 'console';


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


export interface Profile {
  'sas-endpoint': string;
  'client-id': string;
  'client-secret': string;
  'compute-context': string;
  'user'?: string;
  'selected': boolean;
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

  async getSelectedProfile(): Promise<ProfileDetail | undefined> {
    const profileList = this.value;
    const selected = Object.keys(this.value).find(function (name) {
      return name in profileList && profileList['selected'];
    });
    return <ProfileDetail>{ name: selected, profile: profileList[selected] };
  }

  async getProfileByName(name: string): Promise<Profile> {
    let profile: Profile = {
      'sas-endpoint': '',
      'client-id': '',
      'client-secret': '',
      'compute-context': '',
      'selected': false,
    }
    if (name in this.value) {
      profile = this.value[name];
    }
    return profile;
  }

  async upsertProfile(name: string, profile: Profile): Promise<void> {
    this.value[name] = profile;
    await this.update(this.value);
  }

  async deleteProfile(name: string): Promise<void> {
    if (name in this.value) {
      delete this.value[name];
      await this.update(this.value);
    }
  }

  async prompt(name: string, setDefault = false): Promise<Profile> {
    const profile = name in this.value ? this.value[name] : <Profile>{ "sas-endpoint": "", "client-id": "", "client-secret": "", "compute-context": "" }

    if (!profile['sas-endpoint'] || setDefault) {
      profile['sas-endpoint'] = await this.createInputTextBox(NEW_HOSTNAME_PLACEHOLDER, NEW_HOSTNAME_TITLE, profile['sas-endpoint']);
    }
    if (!profile['client-id'] || setDefault) {
      profile['client-id'] = await this.createInputTextBox(CLIENT_ID_PLACEHOLDER, CLIENT_ID_TITLE, profile['client-id']);
    }
    if (!profile['client-secret'] || setDefault) {
      profile['client-secret'] = await this.createInputTextBox(CLIENT_SECRET_PLACEHOLDER, CLIENT_SECRET_TITLE, profile['client-secret']);
    }
    if (!profile['compute-context'] || setDefault) {
      profile['compute-context'] = await this.createInputTextBox(CLIENT_SECRET_PLACEHOLDER, CLIENT_SECRET_TITLE, profile['compute-context']);
    }
    this.update(profile);
    return profile;
  }

  private async createInputTextBox(placeHolder: string, title: string, defaultValue: string): Promise<Thenable<string | undefined>> {
    return window.showInputBox({
      title,
      ignoreFocusOut: true,
      placeHolder: placeHolder,
      value: defaultValue
    });
  }
}