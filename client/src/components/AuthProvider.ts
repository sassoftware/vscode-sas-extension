// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationSession,
  commands,
  ConfigurationChangeEvent,
  Disposable,
  Event,
  EventEmitter,
  SecretStorage,
  workspace,
} from "vscode";
import { profileConfig } from "../commands/profile";
import { ConnectionType } from "../components/profile";
import { getTokens, refreshToken } from "../connection/rest/auth";
import { getCurrentUser } from "../connection/rest/identities";

const SECRET_KEY = "SASAuth-123123";

interface SASAuthSession extends AuthenticationSession {
  refreshToken?: string;
}

export class SASAuthProvider implements AuthenticationProvider, Disposable {
  static id = "SAS";

  private _disposables: Disposable[];
  private _lastSession: SASAuthSession | undefined;
  private _onDidChangeSessions =
    new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
  get onDidChangeSessions(): Event<AuthenticationProviderAuthenticationSessionsChangeEvent> {
    return this._onDidChangeSessions.event;
  }

  constructor(private readonly secretStorage: SecretStorage) {
    this._disposables = [
      this._onDidChangeSessions,
      workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
        if (
          event.affectsConfiguration("SAS.connectionProfiles") &&
          this._lastSession
        ) {
          this._onDidChangeSessions.fire({
            added: [],
            changed: [],
            removed: [this._lastSession],
          });
          this._lastSession = undefined;
        }
      }),
    ];
  }

  dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
  }

  async getSessions(): Promise<readonly AuthenticationSession[]> {
    const sessions = await this._getSessions();
    if (sessions.length === 0) {
      commands.executeCommand("setContext", "SAS.authorized", false);
    } else {
      if (this._lastSession?.id !== sessions[0].id) {
        // have to fire change event so that the Accounts menu can update after switching profile
        this._lastSession = sessions[0];
        this._onDidChangeSessions.fire({
          added: [],
          changed: sessions,
          removed: [],
        });
      }
      commands.executeCommand("setContext", "SAS.authorized", true);
    }
    return sessions;
  }

  private async _getSessions(): Promise<readonly AuthenticationSession[]> {
    const sessions = await this.getStoredSessions();
    if (!sessions) {
      return [];
    }

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
      await this.removeSession(session.id, true);
      return [];
    }
    const accessToken = tokens.access_token;
    if (accessToken === session.accessToken) {
      return [session];
    }
    const newSession = { ...session, accessToken: tokens.access_token };
    await this.writeSession(newSession);

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
    const profileName = profileConfig.getActiveProfile();
    const session: SASAuthSession = {
      id: profileName,
      account: { id: user.id, label: user.name },
      accessToken,
      refreshToken,
      scopes: [],
    };

    await this.writeSession(session);
    this._lastSession = session;
    this._onDidChangeSessions.fire({
      added: [session],
      changed: [],
      removed: [],
    });

    commands.executeCommand("setContext", "SAS.authorized", true);

    return session;
  }

  private async writeSession(session: SASAuthSession): Promise<void> {
    const storedSessions = await this.getStoredSessions();

    const sessions = {
      ...(storedSessions || {}),
      [session.id]: session,
    };

    await this.secretStorage.store(SECRET_KEY, JSON.stringify(sessions));
  }

  async removeSession(sessionId: string, silent?: boolean): Promise<void> {
    const sessions = await this.getStoredSessions();
    if (!sessions) {
      return;
    }
    const profileName = profileConfig.getActiveProfile();
    const id = sessions[sessionId] ? sessionId : profileName;
    const session = sessions[id];
    if (!session) {
      return;
    }
    delete sessions[id];

    if (!silent) {
      // Triggered by user sign out from the Accounts menu
      // VS Code will sign out all sessions by this account
      Object.values(sessions).forEach((s) => {
        if (s.account.id === session.account.id) {
          delete sessions[s.id];
        }
      });
    }

    await this.secretStorage.store(SECRET_KEY, JSON.stringify(sessions));

    this._lastSession = undefined;
    this._onDidChangeSessions.fire({
      added: [],
      changed: [],
      removed: [session],
    });

    if (!silent) {
      commands.executeCommand("setContext", "SAS.authorized", false);
    }
  }

  private async getStoredSessions(): Promise<
    Record<string, SASAuthSession> | undefined
  > {
    const storedSessionData = await this.secretStorage.get(SECRET_KEY);
    if (!storedSessionData) {
      return;
    }

    return JSON.parse(storedSessionData);
  }
}
