// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, l10n } from "vscode";

import { Column } from "../connection/rest/api/compute";
import { TableInfo } from "../connection/rest/api/compute";
import { WebView } from "./WebviewManager";

class TablePropertiesViewer extends WebView {
  constructor(
    private readonly extensionUri: Uri,
    private readonly tableName: string,
    private readonly tableInfo: TableInfo,
    private readonly columns: Column[],
    private readonly showColumns: boolean = false,
  ) {
    super();
  }

  public render(): WebView {
    const policies = [
      `default-src 'none';`,
      `font-src ${this.panel.webview.cspSource} data:;`,
      `img-src ${this.panel.webview.cspSource} data:;`,
      `script-src ${this.panel.webview.cspSource};`,
      `style-src ${this.panel.webview.cspSource};`,
    ];
    this.panel.webview.html = this.getContent(policies);
    return this;
  }

  public processMessage(): void {
    // No messages to process for this static viewer
  }

  public getContent(policies: string[]): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="${policies.join(
            " ",
          )}" />
          <link rel="stylesheet" href="${this.webviewUri(
            this.extensionUri,
            "TablePropertiesViewer.css",
          )}">
          <title>${l10n.t("Table Properties")}</title>
      </head>
      <body>
          <div class="container">
              <h1>${l10n.t("Table: {tableName}", { tableName: this.tableName })}</h1>
              
              <div class="tabs">
                  <button class="tab active" data-tab="properties">${l10n.t("General")}</button>
                  <button class="tab" data-tab="columns">${l10n.t("Columns")}</button>
              </div>
              
              <div id="properties" class="tab-content active">
                  ${this.generatePropertiesContent()}
              </div>
              
              <div id="columns" class="tab-content">
                  ${this.generateColumnsContent()}
              </div>
          </div>
          
          <script type="module" src="${this.webviewUri(
            this.extensionUri,
            "TablePropertiesViewer.js",
          )}"></script>
      </body>
      </html>
    `;
  }

  private generatePropertiesContent(): string {
    const formatValue = (value: unknown): string => {
      if (value === null || value === undefined) {
        return "";
      }
      if (typeof value === "number") {
        return value.toLocaleString();
      }
      return String(value);
    };

    const formatDate = (value: unknown): string => {
      if (!value) {
        return "";
      }
      try {
        return new Date(String(value)).toLocaleString();
      } catch {
        return String(value);
      }
    };

    return `
      <div class="section-title">${l10n.t("General Information")}</div>
      <table class="properties-table">
        <tr>
          <td class="property-label">${l10n.t("Name")}</td>
          <td>${formatValue(this.tableInfo.name)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Library")}</td>
          <td>${formatValue(this.tableInfo.libref)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Type")}</td>
          <td>${formatValue(this.tableInfo.type)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Label")}</td>
          <td>${formatValue(this.tableInfo.label)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Engine")}</td>
          <td>${formatValue(this.tableInfo.engine)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Extended Type")}</td>
          <td>${formatValue(this.tableInfo.extendedType)}</td>
        </tr>
      </table>

      <div class="section-title">${l10n.t("Size Information")}</div>
      <table class="properties-table">
        <tr>
          <td class="property-label">${l10n.t("Number of Rows")}</td>
          <td>${formatValue(this.tableInfo.rowCount)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Number of Columns")}</td>
          <td>${formatValue(this.tableInfo.columnCount)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Logical Record Count")}</td>
          <td>${formatValue(this.tableInfo.logicalRecordCount)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Physical Record Count")}</td>
          <td>${formatValue(this.tableInfo.physicalRecordCount)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Record Length")}</td>
          <td>${formatValue(this.tableInfo.recordLength)}</td>
        </tr>
      </table>

      <div class="section-title">${l10n.t("Technical Information")}</div>
      <table class="properties-table">
        <tr>
          <td class="property-label">${l10n.t("Created")}</td>
          <td>${formatDate(this.tableInfo.creationTimeStamp)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Modified")}</td>
          <td>${formatDate(this.tableInfo.modifiedTimeStamp)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Compression")}</td>
          <td>${formatValue(this.tableInfo.compressionRoutine)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Character Encoding")}</td>
          <td>${formatValue(this.tableInfo.encoding)}</td>
        </tr>
        <tr>
          <td class="property-label">${l10n.t("Bookmark Length")}</td>
          <td>${formatValue(this.tableInfo.bookmarkLength)}</td>
        </tr>
      </table>
    `;
  }

  private generateColumnsContent(): string {
    const formatValue = (value: unknown): string => {
      if (value === null || value === undefined) {
        return "";
      }
      return String(value);
    };

    const columnsRows = this.columns
      .map(
        (column, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${formatValue(column.name)}</td>
            <td>${formatValue(column.type)}</td>
            <td>${formatValue(column.length)}</td>
            <td>${formatValue(column.format?.name)}</td>
            <td>${formatValue(column.informat?.name)}</td>
            <td>${formatValue(column.label)}</td>
          </tr>
        `,
      )
      .join("");

    return `
      <div class="section-title">${l10n.t("Columns ({count})", { count: this.columns.length })}</div>
      <table class="properties-table">
        <thead>
          <tr>
            <th>${l10n.t("#")}</th>
            <th>${l10n.t("Name")}</th>
            <th>${l10n.t("Type")}</th>
            <th>${l10n.t("Length")}</th>
            <th>${l10n.t("Format")}</th>
            <th>${l10n.t("Informat")}</th>
            <th>${l10n.t("Label")}</th>
          </tr>
        </thead>
        <tbody>
          ${columnsRows}
        </tbody>
      </table>
    `;
  }
}

export default TablePropertiesViewer;
