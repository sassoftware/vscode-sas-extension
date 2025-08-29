import * as vscode from "vscode";

import { assert } from "chai";
import sinon from "sinon";

import { profileConfig } from "../../../src/commands/profile";
import { ConnectionType } from "../../../src/components/profile";
import { getCodeDocumentConstructionParameters } from "../../../src/components/utils/SASCodeDocumentHelper";

describe("sas code document helper", () => {
  describe("getCodeDocumentConstructionParameters", () => {
    let getConfigurationStub: sinon.SinonStub;
    let colorThemeStub: sinon.SinonStub;
    let htmlStyle = "(auto)";
    const htmlCustomStyle = { dark: "MyCustomDarkStyle" };

    beforeEach(() => {
      getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
      getConfigurationStub.withArgs("SAS").returns({
        get: (key: string) => {
          if (key === "results.html.style") {
            return htmlStyle;
          }
          if (key === "results.html.custom.style") {
            return htmlCustomStyle;
          }
          return undefined;
        },
      });
      colorThemeStub = sinon
        .stub(vscode.window, "activeColorTheme")
        .value({ kind: vscode.ColorThemeKind.Dark });
      profileConfig.getActiveProfileDetail = () => ({
        name: "mock",
        profile: {
          connectionType: ConnectionType.Rest,
          endpoint: "http://example.com",
        },
      });
    });

    afterEach(() => {
      getConfigurationStub.restore();
      colorThemeStub.restore();
    });

    const mockTextDocument = {
      languageId: "sas",
      getText: function () {
        return "data _null_; run;";
      },
      uri: vscode.Uri.file("/fake/path/test.sas"),
      fileName: "/fake/path/test.sas",
      lineCount: 1,
      lineAt: function (lineOrPos: number | vscode.Position = 0) {
        const lineNumber =
          typeof lineOrPos === "number" ? lineOrPos : lineOrPos.line;
        return {
          lineNumber,
          text: "data _null_; run;",
          range: new vscode.Range(lineNumber, 0, lineNumber, 16),
          rangeIncludingLineBreak: new vscode.Range(
            lineNumber,
            0,
            lineNumber,
            17,
          ),
          firstNonWhitespaceCharacterIndex: 0,
          isEmptyOrWhitespace: false,
        };
      },
      isUntitled: false,
      version: 1,
      isDirty: false,
      isClosed: false,
      save: async () => true,
      eol: 1,
      offsetAt: () => 0,
      positionAt: () => new vscode.Position(0, 0),
      validateRange: (range: vscode.Range) => range,
      validatePosition: (pos: vscode.Position) => pos,
      getWordRangeAtPosition: () => undefined,
    };

    it("should construct parameters with default values", () => {
      const params = getCodeDocumentConstructionParameters(mockTextDocument);
      assert.equal(params.languageId, "sas");
      assert.equal(params.code, "data _null_; run;");
      assert.equal(
        params.uri,
        vscode.Uri.file("/fake/path/test.sas").toString(),
      );
      assert.equal(params.fileName, "/fake/path/test.sas");
    });

    it("should use custom style from results.html.custom.style for dark theme", () => {
      const params = getCodeDocumentConstructionParameters(mockTextDocument);
      // the custom style should be applied
      assert.equal(params.htmlStyle, "MyCustomDarkStyle");
    });

    it("should not use custom style from results.html.custom.style for dark theme when not defined", () => {
      htmlCustomStyle.dark = undefined;
      const params = getCodeDocumentConstructionParameters(mockTextDocument);
      // the default Ignite style should be used
      assert.equal(params.htmlStyle, "Ignite");
    });

    it("should use no style when results.html.style is '(server default)'", () => {
      htmlStyle = "(server default)";
      const params = getCodeDocumentConstructionParameters(mockTextDocument);
      // no style should be applied
      assert.equal(params.htmlStyle, "");
    });

    it("should use results.html.style when results.html.style is neither '(auto)' nor '(server default)'", () => {
      htmlStyle = "HTMLBlue";
      const params = getCodeDocumentConstructionParameters(mockTextDocument);
      // the results.html.style should be applied
      assert.equal(params.htmlStyle, "HTMLBlue");
    });
  });
});
