// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf
import { window } from 'vscode';
export const PROFILE_TITLE = 'Enter a New Profile Name, or choose from current profile list!';

export const NEW_PROFILE_TITLE = 'Please enter new Profile Name';
export const NEW_PROFILE_PLACEHOLDER = 'Enter New Profile Name...';

export const NEW_HOSTNAME_TITLE = 'Hostname for new profile (e.g. https://daily.plover-m1.unx.sas.com)';
export const NEW_HOSTNAME_PLACEHOLDER = 'Enter hostname...';

export const UPDATE_HOSTNAME_TITLE = 'Hostname for profile';
export const UPDATE_HOSTNAME_PLACEHOLDER = 'Enter hostname...';

export const COMPUTE_CONTEXT_TITLE = 'Compute Context';
export const COMPUTE_CONTEXT_PLACEHOLDER = 'Enter Compute Context...';

export const CLIENT_ID_TITLE = 'Client ID (Leave blank to use tokenFile)';
export const CLIENT_ID_PLACEHOLDER = 'Enter Client ID...';

export const CLIENT_SECRET_TITLE = 'Client Secret';
export const CLIENT_SECRET_PLACEHOLDER = 'Enter Client Secret...';

export const USERNAME_TITLE = 'SAS Username';
export const USERNAME_PLACEHOLDER = 'Enter a SAS Username...';

export const PASSWORD_PLACEHOLDER = 'Enter a SAS Username...';


export async function createInputTextBox(placeHolder: string, title: string, defaultValue = null, password = false) : Promise<Thenable<string | undefined>> {
  return window.showInputBox({
    title,
    placeHolder,
    password,
    value: defaultValue,
    ignoreFocusOut: true
  });
}