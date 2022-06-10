// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { ProfileConfig, ProfileType } from './profile';
import { USERNAME_TITLE, USERNAME_PLACEHOLDER, PASSWORD_PLACEHOLDER, createInputTextBox } from '../utils/userInput';

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
  const validProfile = await profileConfig.validateProfile(activeProfile);

  let user = '';
  let password = '';
  if(validProfile.type === ProfileType.Password){
    user = await createInputTextBox(USERNAME_PLACEHOLDER, USERNAME_TITLE, null, false) || user;
    password = await createInputTextBox(PASSWORD_PLACEHOLDER, `Password for ${user}`, null, true) || password;
  }

  return new Promise((resolve, reject) => {
    if(validProfile.type === ProfileType.Error){
      reject(validProfile.error);
    }
    else if(validProfile.type === ProfileType.TokenFile){
      resolve({
        authType: "server",
        host: validProfile.profile['sas-endpoint'],
        token: validProfile.data ?? "",
        tokenType: "bearer",
      });
    }
    else if(validProfile.type === ProfileType.Password){
      if(!user || !password){
        reject("Please enter username and password");
      }
      resolve({
        authType: "password",
        host: validProfile.profile['sas-endpoint'],
        clientID: validProfile.profile['client-id'] ?? '',
        clientSecret: validProfile.profile['client-secret'] ?? '',
        computeContext: validProfile.profile['compute-context'],
        user,
        password
      });
    }
  });
}
