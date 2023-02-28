import { Uri, Webview } from "vscode";
import { TableData, TableRow } from "./types";

// TODO #129 Consider moving this into some kind of templating object
// or talking over the merits / drawbacks of using React for this
// kind of thing
const renderTableView = (
  webview: Webview,
  tableData: TableData,
  extensionUri: Uri
): void => {
  const webviewUri = webview.asWebviewUri(
    Uri.joinPath(extensionUri, "client", "dist", "webview.js")
  );
  webview.html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Table</title>
      </head>
      <body>
        <vscode-data-grid aria-label="Basic">
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
            .join("")}
        </vscode-data-grid>
        <script type="module" src="${webviewUri}"></script>
      </body>
    </html>
  `;
};

export default renderTableView;
