import {
  Event,
  ProviderResult,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from "vscode";

class SASContentTreeItem extends TreeItem {
  children: TreeItem[] | undefined;

  constructor(label: string, children?: TreeItem[]) {
    super(
      label,
      children === undefined
        ? TreeItemCollapsibleState.None
        : TreeItemCollapsibleState.Collapsed
    );
    this.children = children;
  }
}

class SASContentProvider implements TreeDataProvider<TreeItem> {
  public onDidChangeTreeData?: Event<void | TreeItem | TreeItem[]>;
  private data: TreeItem[];

  constructor() {
    this.data = [
      new SASContentTreeItem("Hey", [
        new SASContentTreeItem("What?"),
        new SASContentTreeItem("Now?"),
      ]),
      new SASContentTreeItem("Bye", [
        new SASContentTreeItem("To?"),
        new SASContentTreeItem("OIJ?"),
      ]),
    ];
  }

  getTreeItem(element: TreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(element?: TreeItem): ProviderResult<TreeItem[]> {
    if (element === undefined) {
      console.log("getting all the data");
      return this.data;
    }
    console.log("Im here");
    return (element as SASContentTreeItem).children;
  }
}

export default SASContentProvider;
