// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { readFile } from "fs";
import { window, workspace } from "vscode";

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

export function getAuthConfig(): Promise<AuthConfig> {
  return new Promise((resolve, reject) => {
    const config = workspace.getConfiguration("SAS.session");
    const host: string = config.get("host");
    if (host === "") {
      reject("SAS server host in Settings is required.");
      return;
    }

    const tokenFile: string = config.get("tokenFile");
    if (tokenFile.length > 0) {
      readFile(tokenFile, (err, data) => {
        if (err && err.message) {
          reject(err.message);
          return;
        }
        resolve({
          authType: "server",
          host,
          token: data.toString(),
          tokenType: "bearer",
        });
      });
      return;
    }

    // no token file found. Go with password flow
    const user: string = config.get("user");
    const clientID: string = config.get("clientId");
    const clientSecret: string = config.get("clientSecret");
    if (user === "" || clientID === "") {
      reject(
        "Either token file, or user and client ID/Secret needed for authentication."
      );
      return;
    }
    window
      .showInputBox({
        placeHolder: `password for ${user}`,
        password: true,
      })
      .then((password) => {
        if (password)
          resolve({
            authType: "password",
            host,
            clientID,
            clientSecret,
            user,
            password,
          });
        else reject("No password");
      });
  });
}
