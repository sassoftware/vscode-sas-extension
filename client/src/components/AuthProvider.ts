// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationSession,
  Disposable,
  Event,
  EventEmitter,
  SecretStorage,
} from "vscode";
import { profileConfig } from "../commands/profile";
import { getTokens, refreshToken } from "../connection/rest/auth";
import { getCurrentUser } from "../connection/rest/identities";

const SECRET_KEY = "SASAuth";

interface SASAuthSession extends AuthenticationSession {
  refreshToken?: string;
}

export class SASAuthProvider implements AuthenticationProvider, Disposable {
  static id = "SAS";

  private _onDidChangeSessions =
    new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
  get onDidChangeSessions(): Event<AuthenticationProviderAuthenticationSessionsChangeEvent> {
    return this._onDidChangeSessions.event;
  }

  constructor(private readonly secretStorage: SecretStorage) {}

  dispose(): void {
    this._onDidChangeSessions.dispose();
  }

  async getSessions(): Promise<readonly AuthenticationSession[]> {
    const stored = await this.secretStorage.get(SECRET_KEY);
    if (!stored) {
      return [];
    }
    const session: SASAuthSession = JSON.parse(stored);
    const activeProfile = profileConfig.getActiveProfileDetail();
    const tokens = await refreshToken(activeProfile.profile, {
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });
    if (!tokens) {
      // refresh token failed, the stored session is not valid anymore
      await this.removeSession();
      return [];
    }
    const accessToken = tokens.access_token;
    if (accessToken === session.accessToken) {
      return [session];
    }
    const newSession = { ...session, accessToken: tokens.access_token };
    await this.secretStorage.store(SECRET_KEY, JSON.stringify(newSession));
    return [newSession];
  }

  async createSession(): Promise<AuthenticationSession> {
    const activeProfile = profileConfig.getActiveProfileDetail();
    const { access_token: accessToken, refresh_token: refreshToken } =
      await getTokens(activeProfile.profile);
    const user = await getCurrentUser({
      endpoint: activeProfile.profile.endpoint,
      accessToken,
    });
    const session: SASAuthSession = {
      id: "SAS",
      account: { id: user.id, label: user.name },
      accessToken,
      refreshToken,
      scopes: [],
    };
    await this.secretStorage.store(SECRET_KEY, JSON.stringify(session));
    return session;
  }

  async removeSession(): Promise<void> {
    await this.secretStorage.delete(SECRET_KEY);
  }
}
