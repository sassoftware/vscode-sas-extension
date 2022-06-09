// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { readFile } from "fs";
import { window, workspace } from "vscode";
import { ProfileConfig } from './profile';
import { createInputTextBox, USERNAME_TITLE, USERNAME_PLACEHOLDER } from '../utils/userInput';

export type AuthConfig =
  | {
    authType: "server";
    host: string;
    token: string;
    tokenType: "bearer";
  }
  | {
    authType: "password";
    host: string;
    clientID: string;
    clientSecret: string;
    user: string;
    password: string;
    computeContext: string;
  };

export async function getAuthConfig(profileConfig: ProfileConfig): Promise<AuthConfig> {
  const activeProfile = await profileConfig.getActiveProfile();
  const user: string = await createInputTextBox(USERNAME_PLACEHOLDER, USERNAME_TITLE);

  return new Promise((resolve, reject) => {
    window
      .showInputBox({
        title: `Password for ${user}`,
        placeHolder: 'Enter a password...',
        password: true,
      })
      .then((password) => {
        if (password && activeProfile)
          resolve({
            authType: "password",
            host: activeProfile.profile['sas-endpoint'],
            clientID: activeProfile.profile['client-id'],
            clientSecret: activeProfile.profile['client-secret'],
            user,
            password,
            computeContext: activeProfile.profile['compute-context']
          });
        else reject("No password");
      });
  });
}
