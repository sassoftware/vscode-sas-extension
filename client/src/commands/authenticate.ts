import { window, ProgressLocation, commands } from "vscode";
import { getSession, Session } from "../session";

export async function authenticate(): Promise<Session> {
  commands.executeCommand("setContext", "SAS.authenticating", true);

  const session = getSession();

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Connecting to SAS session...",
    },
    async () => {
      await window.withProgress(
        {
          location: { viewId: "sas-content-get-started" },
        },
        session.setup
      );
    }
  );

  commands.executeCommand("setContext", "SAS.authenticated", true);
  commands.executeCommand("setContext", "SAS.authenticating", false);

  return session;
}
