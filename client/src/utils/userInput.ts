// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf
import { window } from 'vscode';

export interface ProfilePrompt {
  title: string;  
  placeholder: string;
}
export enum ProfilePromptType {
  Profile = 'profile',
  NewProfile = 'new-profile',
  ClientId = 'client-id',
  HostName = 'hostname',
  UpdateHostname = 'update-hostname',
  ComputeContext = 'compute-context',
  ClientSecret = 'client-secret',
  Username = 'username',
  Password = 'password',
  ConfigFile = 'config-file',
  TokenFile = 'token-file'
}

export type ProfilePromptInput = {
  [key in ProfilePromptType]: ProfilePrompt;
}

export const input: ProfilePromptInput = {
  [ProfilePromptType.Profile]: { title: "Enter a New Profile Name, or choose from current profile list!", placeholder: "Enter Profile Name..."},
  [ProfilePromptType.NewProfile]: { title: "Please enter new Profile Name", placeholder: "Enter New Profile Name..."},
  [ProfilePromptType.HostName]: { title: "Hostname for new profile (e.g. https://example.sas.com)", placeholder: "Enter hostname..."},
  [ProfilePromptType.UpdateHostname]: { title: "Hostname for profile", placeholder: "Enter hostname..."},
  [ProfilePromptType.ComputeContext]: { title: "Compute Context", placeholder: "Enter Compute Context..."},
  [ProfilePromptType.ClientId]: { title: "Client ID", placeholder: "Enter New Client ID..."},
  [ProfilePromptType.ClientSecret]: { title: "Client Secret", placeholder: "Enter Client Secret..."},
  [ProfilePromptType.Username]: { title: "SAS Username", placeholder: "Enter a SAS Username..."},
  [ProfilePromptType.Password]: { title: "SAS Password", placeholder: "Enter a SAS Password..."},
  [ProfilePromptType.ConfigFile]: { title: "SAS Profile Config Path", placeholder: "Enter Config File Path..."},
  [ProfilePromptType.TokenFile]: { title: "SAS Token File Path", placeholder: "Enter Token File Path..."}
}

export function getProfilePrompt(type: ProfilePromptType): ProfilePrompt {
  return input[type];
}

export async function createInputTextBox(profilePromptType: ProfilePromptType, defaultValue = null, password = false) : Promise<Thenable<string | undefined>> {
  const profilePrompt: ProfilePrompt = input[profilePromptType];
  return window.showInputBox({
    title: profilePrompt.title,
    placeHolder: profilePrompt.placeholder,
    password,
    value: defaultValue,
    ignoreFocusOut: true
  });
}