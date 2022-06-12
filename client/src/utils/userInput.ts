// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf
import { window } from 'vscode';


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
  [ProfilePromptType.Profile]: { title: "Enter a New Profile Name, or choose from current profile list!", placeholder: "Enter Profile Name..." },
  [ProfilePromptType.NewProfile]: { title: "Please enter new Profile Name", placeholder: "Enter New Profile Name..." },
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
