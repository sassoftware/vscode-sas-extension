import ContentDataProvider from "./ContentDataProvider";
import {
  ExtensionContext,
  Uri,
  commands,
  window,
  workspace,
  TextDocument,
} from "vscode";
import { profileConfig } from "../../commands/profile";
import { DataDescriptor } from "./viya/DataDescriptor";
import { ContentModel } from "./viya/ContentModel";
import { ContentItem } from "./types";

const createFileValidator =
  (errorMessage: string) =>
  (value: string): string | null =>
    /^([a-zA-Z0-9\s._-]+)\.\w+$/.test(value) ? null : errorMessage;

const createFolderValidator =
  (errorMessage: string) =>
  (value: string): string | null =>
    /^([a-zA-Z0-9\s_-]+)$/.test(value) ? null : errorMessage;

class ContentNavigator {
  constructor(context: ExtensionContext) {
    const dataDescriptor = new DataDescriptor();
    const treeDataProvider = new ContentDataProvider(
      new ContentModel(
        profileConfig.getActiveProfileDetail()?.profile.endpoint,
        dataDescriptor
      )
    );
    const treeView = window.createTreeView("sas-content-navigator", {
      treeDataProvider,
    });
    treeView.onDidChangeVisibility(async () => {
      if (treeView.visible) {
        await treeDataProvider.setup();
      }
    });

    context.subscriptions.push(treeView);

    workspace.registerFileSystemProvider("sas", treeDataProvider);
    commands.registerCommand(
      "SAS.openSASfile",
      async (document: TextDocument) => await window.showTextDocument(document)
    );

    commands.registerCommand(
      "SAS.deleteResource",
      async (resource: ContentItem) => {
        if (!(await treeDataProvider.deleteResource(resource))) {
          window.showErrorMessage("Unable to delete file");
        }
      }
    );

    commands.registerCommand("SAS.refreshResources", () =>
      treeDataProvider.refresh()
    );

    commands.registerCommand(
      "SAS.addFileResource",
      async (resource: ContentItem) => {
        const fileName = await window.showInputBox({
          prompt: "Please enter a file name",
          title: "New file",
          validateInput: createFileValidator("Invalid file name"),
        });
        if (!fileName) {
          return;
        }

        const success = await treeDataProvider.createFile(resource, fileName);
        if (!success) {
          window.showErrorMessage(`Unable to create file "${fileName}"`);
        }
      }
    );

    commands.registerCommand(
      "SAS.addFolderResource",
      async (resource: ContentItem) => {
        const folderName = await window.showInputBox({
          prompt: "Please enter a folder name",
          title: "New folder",
          validateInput: createFolderValidator("Invalid folder name"),
        });
        if (!folderName) {
          return;
        }

        const success = await treeDataProvider.createFolder(
          resource,
          folderName
        );
        if (!success) {
          window.showErrorMessage(`Unable to create folder "${folderName}"`);
        }
      }
    );

    commands.registerCommand(
      "SAS.renameResource",
      async (resource: ContentItem) => {
        const isContainer = dataDescriptor.isContainer(resource);

        const name = await window.showInputBox({
          prompt: "Please enter a new name",
          title: isContainer ? "Rename folder" : "Rename file",
          value: resource.name,
          validateInput: isContainer
            ? createFolderValidator("Invalid folder name")
            : createFileValidator("Invalid file name"),
        });

        if (name === resource.name) {
          return;
        }

        const success = await treeDataProvider.renameResource(resource, name);
        if (!success) {
          window.showErrorMessage(
            `Unable to rename "${resource.name} to ${name}"`
          );
        }
      }
    );
  }
}

export default ContentNavigator;
