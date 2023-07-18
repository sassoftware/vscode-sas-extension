// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import axios from "axios";
import { CancellationTokenSource, env, Uri, window } from "vscode";
import { URLSearchParams } from "url";
import { createHash } from "crypto";
import { Config } from ".";
import { RootApi } from "./api/compute";
import { Configuration } from "./api/configuration";

interface Tokens {
  access_token: string;
  refresh_token: string;
}

export async function refreshToken(
  config: Config,
  tokens: Tokens,
): Promise<Tokens | undefined> {
  const clientId = config.clientId || "vscode";
  const clientSecret = config.clientSecret ?? "";
  const rootApi = RootApi(
    new Configuration({
      basePath: config.endpoint + "/compute",
      accessToken: tokens.access_token,
    }),
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
          }).toString(),
        )
        .then(
          (res) => {
            tokens = res.data;
          },
          () => {
            // refresh token failed, has to login again
            tokens = undefined;
          },
        );
    }
    throw err;
  });

  return tokens;
}

export async function getTokens(
  config: Config,
  tokens?: Tokens,
): Promise<Tokens> {
  const clientId = config.clientId || "vscode";
  const clientSecret = config.clientSecret ?? "";

  const { codeVerifier, codeChallenge } = getPKCE();

  const callbackUrl = await env.asExternalUri(
    Uri.parse(`${env.uriScheme}://sas.sas-lsp`),
  );

  const params = new URLSearchParams([
    ["client_id", clientId],
    ["response_type", "code"],
    ["code_challenge_method", "S256"],
    ["code_challenge", codeChallenge],
    ["state", encodeURIComponent(callbackUrl.toString(true))],
  ]);
  await env.openExternal(
    Uri.parse(
      `${config.endpoint}/SASLogon/oauth/authorize?${params.toString()}`,
    ),
  );

  const cancellationToken = new CancellationTokenSource();
  let authCode: string;
  const handler = window.registerUriHandler({
    handleUri: (uri) => {
      const code = new URLSearchParams(uri.query).get("code");
      if (code) {
        authCode = code;
        cancellationToken.cancel();
      }
    },
  });
  const inputCode = await window.showInputBox(
    {
      placeHolder: `Paste authorization code here`,
      password: true,
      ignoreFocusOut: true,
    },
    cancellationToken.token,
  );
  handler.dispose();
  if (!authCode && inputCode) {
    authCode = inputCode;
  }
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
      }).toString(),
    )
  ).data;
  return tokens;
}

function getPKCE() {
  // Refers to https://www.rfc-editor.org/rfc/rfc7636
  const LENGTH = 128;
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let codeVerifier = "";
  for (let i = 0; i < LENGTH; i++) {
    codeVerifier += possible.charAt(
      Math.floor(Math.random() * possible.length),
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
