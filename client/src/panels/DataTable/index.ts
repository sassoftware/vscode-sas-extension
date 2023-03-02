import { Disposable, Uri, ViewColumn, WebviewPanel, window } from "vscode";
import { TableData, TableRow } from "../../components/LibraryNavigator/types";

export enum Commands {
  ReceiveRowData = "SAS.DataTable.receiveRowData",
}

class DataTable {
  public static panels: Record<string, DataTable> = {};
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];
  private _id: string;

  private constructor(
    panel: WebviewPanel,
    extensionUri: Uri,
    tableData: TableData,
    id: string
  ) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._id = id;

    const webviewUri = panel.webview.asWebviewUri(
      Uri.joinPath(extensionUri, "client", "dist", "panels", "DataTable.js")
    );
    this._panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Table</title>
        </head>
        <body>
          <vscode-data-grid class="data-grid">
            <vscode-data-grid-row row-type="header">
              ${tableData.headers.columns
                .map(
                  (column: string, index: number) =>
                    `<vscode-data-grid-cell cell-type="columnheader" grid-column="${
                      index + 1
                    }">${column}</vscode-data-grid-cell>`
                )
                .join("")}
            </vscode-data-grid-row>
            ${tableData.rows
              .map((row: TableRow) => {
                return `
                <vscode-data-grid-row>
                  ${row.cells
                    .map(
                      (cell: string, index: number) =>
                        `<vscode-data-grid-cell grid-column="${
                          index + 1
                        }">${cell}</vscode-data-grid-cell>`
                    )
                    .join("")}
                </vscode-data-grid-row>
              `;
              })
              .join("")}}
          </vscode-data-grid>
          <script type="module" src="${webviewUri}"></script>
        </body>
      </html>
    `;
  }

  public static render(
    extensionUri: Uri,
    id: string,
    name: string,
    tableData: TableData
  ) {
    if (DataTable.panels[id]) {
      DataTable.panels[id]._panel.reveal(ViewColumn.One);
      return;
    }

    const panel = window.createWebviewPanel("tableView", name, ViewColumn.One, {
      enableScripts: true,
    });

    DataTable.panels[id] = new DataTable(panel, extensionUri, tableData, id);
  }

  public dispose() {
    delete DataTable.panels[this._id];

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

export default DataTable;
