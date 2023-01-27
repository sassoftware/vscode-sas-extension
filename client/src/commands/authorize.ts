import { window, ProgressLocation, commands } from "vscode";
import { getSession, Session } from "../connection";
import { profileConfig, switchProfile } from "./profile";

export async function authorize(): Promise<Session> {
  commands.executeCommand("setContext", "SAS.authorizing", true);

  const session = getSession();

  try {
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Connecting to SAS session...",
      },
      async () => {
        // This looks a little weird. The purpose of this is to show both a notification
        // message and a progress bar on the getting started view
        await window.withProgress(
          {
            location: { viewId: "sas-content-get-started" },
          },
          session.setup
        );
      }
    );

    commands.executeCommand("setContext", "SAS.authorized", true);
  } catch (error) {
    throw new Error(error);
  } finally {
    commands.executeCommand("setContext", "SAS.authorizing", false);
  }

  return session;
}

export const checkProfileAndAuthorize = async (): Promise<void> => {
  if (profileConfig.getActiveProfile() === "") {
    await switchProfile();
  }

  if (profileConfig.getActiveProfile() !== "") {
    await authorize();
  }
};
