import ContentDataProvider from "./ContentDataProvider";
import { ExtensionContext, Uri, commands, window, workspace } from "vscode";
import { profileConfig } from "../../commands/profile";
import { DataDescriptor } from "./viya/DataDescriptor";
import { ContentModel } from "./viya/ContentModel";

class ContentNavigator {
  constructor(context: ExtensionContext) {
    const dataDescriptor = new DataDescriptor();
    const model = new ContentModel(
      profileConfig.getActiveProfileDetail()?.profile.endpoint,
      dataDescriptor
    );
    const dataProvider = new ContentDataProvider(model);
    model.serviceInit().then(() => {
      context.subscriptions.push(
        window.createTreeView("SAS.ContentNavigator", {
          treeDataProvider: dataProvider,
        })
      );
    });

    workspace.registerFileSystemProvider("sas", dataProvider);
    commands.registerCommand("SAS.openSASfile", async (resource) =>
      this.openResource(resource)
    );
  }

  private async openResource(resource: Uri): Promise<void> {
    try {
      await window.showTextDocument(resource);
    } catch (error) {
      commands.executeCommand("workbench.action.closeActiveEditor");
      const resourceName = resource.path.split("/").pop().trim() || "";
      window.showErrorMessage(
        `Cannot open ${resourceName ? `"${resourceName}"` : "file"}`
      );
    }
  }
}

export default ContentNavigator;
