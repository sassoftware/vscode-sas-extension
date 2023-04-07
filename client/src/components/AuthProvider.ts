// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationSession,
  commands,
  Disposable,
  Event,
  EventEmitter,
  SecretStorage,
} from "vscode";
import { profileConfig } from "../commands/profile";
import { getTokens, refreshToken } from "../connection/rest/auth";
import { getCurrentUser } from "../connection/rest/identities";
import { ConnectionType } from "../components/profile";

const SECRET_KEY = "SASAuth-2";

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
    const storedSessions = await this.secretStorage.get(SECRET_KEY);
    if (!storedSessions) {
      commands.executeCommand("setContext", "SAS.authorized", false);
      return [];
    }

    const sessions: SASAuthSession = JSON.parse(storedSessions);
    const activeProfile = profileConfig.getActiveProfileDetail();
    const profile = activeProfile?.profile;
    if (!profile || profile.connectionType !== ConnectionType.Rest) {
      return [];
    }
    const profileName = profileConfig.getActiveProfile();
    const session = sessions[profileName];
    if (!session) {
      return [];
    }

    const tokens = await refreshToken(profile, {
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
    await this.writeSession(newSession);
    commands.executeCommand("setContext", "SAS.authorized", true);

    return [newSession];
  }

  async createSession(): Promise<AuthenticationSession> {
    const activeProfile = profileConfig.getActiveProfileDetail();
    const profile = activeProfile.profile;

    if (profile.connectionType !== ConnectionType.Rest) {
      return;
    }

    const { access_token: accessToken, refresh_token: refreshToken } =
      await getTokens(profile);
    const user = await getCurrentUser({
      endpoint: profile.endpoint,
      accessToken,
    });
    const session: SASAuthSession = {
      id: "SAS",
      account: { id: user.id, label: user.name },
      accessToken,
      refreshToken,
      scopes: [],
    };

    await this.writeSession(session);

    commands.executeCommand("setContext", "SAS.authorized", true);

    return session;
  }

  private async writeSession(session: SASAuthSession): Promise<void> {
    const storedSessionData = await this.secretStorage.get(SECRET_KEY);
    const storedSessions = storedSessionData
      ? JSON.parse(storedSessionData)
      : {};
    const profileName = profileConfig.getActiveProfile();
    console.log("aint this a bitch");
    if (!profileName) {
      return;
    }

    const sessions = {
      ...storedSessions,
      [profileName]: session,
    };

    await this.secretStorage.store(SECRET_KEY, JSON.stringify(sessions));
  }

  async removeSession(): Promise<void> {
    await this.secretStorage.delete(SECRET_KEY);
    commands.executeCommand("setContext", "SAS.authorized", false);
  }
}
