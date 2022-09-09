// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  ProfileValidation,
  AuthType,
  ProfilePromptType,
  createInputTextBox,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Profile,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ProfileConfig
} from "./profile";

/**
 * AuthConfig is a type that represents the configuration needed for
 * authentication to a SAS session.  The authentication configurations
 * can be of type server which represents a bearer token or a password
 * which represnts the credentials as user/password with client id and client
 * secret.
 */
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
    };

/**
 * Credentials is an interface that will represent the user credentials
 * for password flow autentication.
 */
interface Credentials {
  user: string;
  password: string;
}

/**
 * Prompts the user for the username credentials when using the password flow.
 *
 * @returns the credentials interface of an object
 */
async function promptCredentials(
  currentUsername: string
): Promise<Credentials> {
  // set the default values for credentials
  const credentials = {
    user: "",
    password: "",
  };
  // If username is already set, do not prompt user for username
  if (currentUsername) {
    credentials.user = currentUsername;
  } else {
    credentials.user =
      (await createInputTextBox(
        ProfilePromptType.Username,
        currentUsername,
        false
      )) ?? "";
  }
  credentials.password =
    (await createInputTextBox(
      ProfilePromptType.Password,
      undefined,
      true,
      credentials.user
    )) ?? "";
  return credentials;
}

/**
 * Calculates the {@link AuthConfig} form the active {@link Profile}.
 *
 * @param profileConfig {@link ProfileConfig} object
 * @returns the Authentication configuration object
 */
export async function getAuthConfig(
  validProfile: ProfileValidation
): Promise<AuthConfig> {
  return new Promise((resolve, reject) => {
    // If password flow is recognized
    if (validProfile.type === AuthType.Password) {
      // The username value in the profile will not change, only display to be used
      promptCredentials(validProfile.profile["username"] ?? "").then(
        (creds) => {
          if (!creds.user || !creds.password) {
            reject("Please enter username and password");
          }
          resolve({
            authType: "password",
            host: validProfile.profile["endpoint"],
            clientID: validProfile.profile["clientId"] ?? "",
            clientSecret: validProfile.profile["clientSecret"] ?? "",
            user: creds.user,
            password: creds.password,
          });
        }
      );
    }
    // If TokenFile flow is recognized
    if (validProfile.type === AuthType.TokenFile) {
      resolve({
        authType: "server",
        host: validProfile.profile["endpoint"],
        token: validProfile.data ?? "",
        tokenType: "bearer",
      });
    }
    // If Error is found
    if (validProfile.type === AuthType.Error) {
      reject(validProfile.error);
    }
  });
}
