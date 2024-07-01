import {
  Disposable,
  ProgressLocation,
  Uri,
  commands,
  l10n,
  window,
} from "vscode";

import { profileConfig } from "../../commands/profile";
import RestContentAdapter from "../../connection/rest/RestContentAdapter";
import { fileValidator } from "../ContentNavigator";
import { ContentModel } from "../ContentNavigator/ContentModel";
import { Messages } from "../ContentNavigator/const";
import { NotebookToFlowConverter } from "../ContentNavigator/convert";
import { ContentItem } from "../ContentNavigator/types";
import { getViyaEndpoint } from "../ContentNavigator/utils";
import { SubscriptionProvider } from "../SubscriptionProvider";
import { ConnectionType } from "../profile";

const flowFileValidator = (value: string): string | null => {
  let res = fileValidator(value);
  if (!value.endsWith(".flw")) {
    res = Messages.InvalidFlowFileNameError;
  }
  return res;
};

class NotebookConverter implements SubscriptionProvider {
  getSubscriptions(): Disposable[] {
    return [
      commands.registerCommand(
        "SAS.convertNotebookToFlow",
        async (resource: ContentItem | Uri) => {
          const activeProfile = profileConfig.getProfileByName(
            profileConfig.getActiveProfile(),
          );

          if (
            !activeProfile ||
            activeProfile.connectionType !== ConnectionType.Rest
          ) {
            return;
          }

          const notebookToFlowConverter = new NotebookToFlowConverter(
            resource,
            new ContentModel(new RestContentAdapter()),
            getViyaEndpoint(),
          );

          const inputName = notebookToFlowConverter.inputName;
          // Open window to chose the name and location of the new .flw file
          const outputName = await window.showInputBox({
            prompt: Messages.ConvertNotebookToFlowPrompt,
            value: inputName.replace(".sasnb", ".flw"),
            validateInput: flowFileValidator,
          });

          if (!outputName) {
            // User canceled the input box
            return;
          }

          await window.withProgress(
            {
              location: ProgressLocation.Notification,
              title: l10n.t("Converting SAS notebook to flow..."),
            },
            async () => {
              if (!notebookToFlowConverter.establishConnection()) {
                window.showErrorMessage(Messages.StudioConnectionError);
                return;
              }

              try {
                const folderName =
                  await notebookToFlowConverter.convert(outputName);
                if (!folderName) {
                  throw new Error(Messages.NotebookToFlowConversionError);
                }

                window.showInformationMessage(
                  l10n.t(Messages.NotebookToFlowConversionSuccess, {
                    folderName,
                  }),
                );
              } catch (e) {
                window.showErrorMessage(e.message);
              }
            },
          );
        },
      ),
    ];
  }
}

export default NotebookConverter;
