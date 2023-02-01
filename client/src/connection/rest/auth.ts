// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import axios from "axios";
import { env, Uri, window } from "vscode";
import { URLSearchParams } from "url";
import { createHash } from "crypto";
import { Config } from ".";
import { RootApi } from "./api/compute";
import { Configuration } from "./api/configuration";

interface Tokens {
  access_token: string;
  refresh_token: string;
}
let tokens: Tokens | undefined;

export async function getAccessToken(config: Config): Promise<string> {
  const clientId = config.clientId || "vscode";
  const clientSecret = config.clientSecret ?? "";

  if (tokens) {
    const rootApi = RootApi(
      new Configuration({ basePath: config.endpoint + "/compute" })
    );
    await rootApi.headersForRoot().catch((err) => {
      if (err.response?.status === 401) {
        // token expired, try refresh token
        return axios
          .post(
            `${config.endpoint}/SASLogon/oauth/token`,
            new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: "refresh_token",
              refresh_token: tokens?.refresh_token,
            }).toString()
          )
          .then(
            (res) => {
              tokens = res.data;
            },
            () => {
              // refresh token failed, has to login again
              tokens = undefined;
            }
          );
      }
      throw err;
    });
  }

  if (tokens) {
    return tokens.access_token;
  }

  const { codeVerifier, codeChallenge } = getPKCE();

  await env.openExternal(
    Uri.parse(
      `${config.endpoint}/SASLogon/oauth/authorize?client_id=${clientId}&response_type=code&code_challenge_method=S256&code_challenge=${codeChallenge}`
    )
  );

  const authCode = await window.showInputBox({
    placeHolder: `Paste authorization code here`,
    password: true,
    ignoreFocusOut: true,
  });
  if (!authCode) {
    throw new Error("No authorization code");
  }

  tokens = (
    await axios.post(
      `${config.endpoint}/SASLogon/oauth/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: authCode,
        code_verifier: codeVerifier,
      }).toString()
    )
  ).data;
  return tokens?.access_token ?? "";
}

export function clearTokens(): void {
  tokens = undefined;
}

function getPKCE() {
  // Refers to https://www.rfc-editor.org/rfc/rfc7636
  const LENGTH = 128;
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let codeVerifier = "";
  for (let i = 0; i < LENGTH; i++) {
    codeVerifier += possible.charAt(
      Math.floor(Math.random() * possible.length)
    );
  }
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return { codeVerifier, codeChallenge };
}
