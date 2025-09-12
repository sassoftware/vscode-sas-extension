// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri } from "vscode";

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
    this.panel.webview.html = this.getContent();
    return this;
  }

  public processMessage(): void {
    // No messages to process for this static viewer
  }

  public getContent(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Table Properties</title>
          <style>
              body {
                  font-family: var(--vscode-font-family);
                  font-size: var(--vscode-font-size);
                  font-weight: var(--vscode-font-weight);
                  color: var(--vscode-foreground);
                  background-color: var(--vscode-editor-background);
                  margin: 0;
                  padding: 16px;
              }
              
              .container {
                  max-width: 1200px;
                  margin: 0 auto;
              }
              
              .tabs {
                  display: flex;
                  border-bottom: 1px solid var(--vscode-panel-border);
                  margin-bottom: 16px;
              }
              
              .tab {
                  padding: 10px 20px;
                  cursor: pointer;
                  border: none;
                  background: none;
                  color: var(--vscode-foreground);
                  border-bottom: 2px solid transparent;
                  font-family: inherit;
                  font-size: inherit;
              }
              
              .tab:hover {
                  background-color: var(--vscode-list-hoverBackground);
              }
              
              .tab.active {
                  border-bottom-color: var(--vscode-focusBorder);
                  color: var(--vscode-tab-activeForeground);
              }
              
              .tab-content {
                  display: none;
                  padding: 20px 0;
              }
              
              .tab-content.active {
                  display: block;
              }
              
              .properties-table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 16px;
              }
              
              .properties-table th,
              .properties-table td {
                  border: 1px solid var(--vscode-panel-border);
                  padding: 8px 12px;
                  text-align: left;
              }
              
              .properties-table th {
                  background-color: var(--vscode-list-hoverBackground);
                  font-weight: bold;
              }
              
              .properties-table tr:nth-child(even) {
                  background-color: var(--vscode-list-hoverBackground);
              }
              
              .property-label {
                  font-weight: bold;
                  min-width: 200px;
              }
              
              .section-title {
                  font-size: 1.2em;
                  font-weight: bold;
                  margin: 20px 0 10px 0;
                  color: var(--vscode-foreground);
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>Table: ${this.tableName}</h1>
              
              <div class="tabs">
                  <button class="tab active" onclick="showTab('properties')">General</button>
                  <button class="tab" onclick="showTab('columns')">Columns</button>
              </div>
              
              <div id="properties" class="tab-content active">
                  ${this.generatePropertiesContent()}
              </div>
              
              <div id="columns" class="tab-content">
                  ${this.generateColumnsContent()}
              </div>
          </div>
          
          <script>
              function showTab(tabName) {
                  // Hide all tab contents
                  const contents = document.querySelectorAll('.tab-content');
                  contents.forEach(content => content.classList.remove('active'));
                  
                  // Remove active class from all tabs
                  const tabs = document.querySelectorAll('.tab');
                  tabs.forEach(tab => tab.classList.remove('active'));
                  
                  // Show selected tab content
                  document.getElementById(tabName).classList.add('active');
                  
                  // Add active class to clicked tab
                  event.target.classList.add('active');
              }
          </script>
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
      <div class="section-title">General Information</div>
      <table class="properties-table">
        <tr>
          <td class="property-label">Name</td>
          <td>${formatValue(this.tableInfo.name)}</td>
        </tr>
        <tr>
          <td class="property-label">Library</td>
          <td>${formatValue(this.tableInfo.libref)}</td>
        </tr>
        <tr>
          <td class="property-label">Type</td>
          <td>${formatValue(this.tableInfo.type)}</td>
        </tr>
        <tr>
          <td class="property-label">Label</td>
          <td>${formatValue(this.tableInfo.label)}</td>
        </tr>
        <tr>
          <td class="property-label">Engine</td>
          <td>${formatValue(this.tableInfo.engine)}</td>
        </tr>
        <tr>
          <td class="property-label">Extended Type</td>
          <td>${formatValue(this.tableInfo.extendedType)}</td>
        </tr>
      </table>

      <div class="section-title">Size Information</div>
      <table class="properties-table">
        <tr>
          <td class="property-label">Number of Rows</td>
          <td>${formatValue(this.tableInfo.rowCount)}</td>
        </tr>
        <tr>
          <td class="property-label">Number of Columns</td>
          <td>${formatValue(this.tableInfo.columnCount)}</td>
        </tr>
        <tr>
          <td class="property-label">Logical Record Count</td>
          <td>${formatValue(this.tableInfo.logicalRecordCount)}</td>
        </tr>
        <tr>
          <td class="property-label">Physical Record Count</td>
          <td>${formatValue(this.tableInfo.physicalRecordCount)}</td>
        </tr>
        <tr>
          <td class="property-label">Record Length</td>
          <td>${formatValue(this.tableInfo.recordLength)}</td>
        </tr>
      </table>

      <div class="section-title">Technical Information</div>
      <table class="properties-table">
        <tr>
          <td class="property-label">Created</td>
          <td>${formatDate(this.tableInfo.creationTimeStamp)}</td>
        </tr>
        <tr>
          <td class="property-label">Modified</td>
          <td>${formatDate(this.tableInfo.modifiedTimeStamp)}</td>
        </tr>
        <tr>
          <td class="property-label">Compression</td>
          <td>${formatValue(this.tableInfo.compressionRoutine)}</td>
        </tr>
        <tr>
          <td class="property-label">Character Encoding</td>
          <td>${formatValue(this.tableInfo.encoding)}</td>
        </tr>
        <tr>
          <td class="property-label">Bookmark Length</td>
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
      <div class="section-title">Columns (${this.columns.length})</div>
      <table class="properties-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Type</th>
            <th>Length</th>
            <th>Format</th>
            <th>Informat</th>
            <th>Label</th>
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
