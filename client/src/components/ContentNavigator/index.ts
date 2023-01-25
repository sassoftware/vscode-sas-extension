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
    const treeView = window.createTreeView("SAS.ContentNavigator", {
      treeDataProvider: dataProvider,
    });
    model.serviceInit().then(() => {
      context.subscriptions.push(treeView);
    });

    workspace.registerFileSystemProvider("sas", dataProvider);
    commands.registerCommand("SAS.openSASfile", async (resource) =>
      this.openResource(resource)
    );
    commands.registerCommand(
      "SAS.deleteResource",
      async (resource) => await dataProvider.delete(resource)
    );
    commands.registerCommand("SAS.refreshResources", () =>
      dataProvider.refresh()
    );
    commands.registerCommand("SAS.addFileResource", async (resource) => {
      const fileName = await window.showInputBox({
        prompt: "Please enter a file name",
        title: "New file",
        // TODO #56 Validate data
        validateInput: (value): string | null => null,
      });

      await dataProvider.createFile(resource, fileName);
    });
    commands.registerCommand("SAS.addFolderResource", async (resource) => {
      const folderName = await window.showInputBox({
        prompt: "Please enter a folder name",
        title: "New folder",
        // TODO #56 Validate data
        validateInput: (value): string | null => null,
      });

      await dataProvider.createFolder(resource, folderName);
    });
  }

  private async openResource(resource: Uri): Promise<void> {
    try {
      // TODO #56 Could we solve this try/catch issue by using `{ preview: false }`
      // as an option?
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
