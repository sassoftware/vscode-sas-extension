import {
  provideVSCodeDesignSystem,
  vsCodeDataGrid,
  vsCodeDataGridCell,
  vsCodeDataGridRow,
} from "@vscode/webview-ui-toolkit";

provideVSCodeDesignSystem().register(
  vsCodeDataGrid(),
  vsCodeDataGridCell(),
  vsCodeDataGridRow()
);
