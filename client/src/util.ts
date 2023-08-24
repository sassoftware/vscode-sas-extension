import {
  window,
  workspace,
  ColorThemeKind,
} from "vscode";

export function wrapCode(code:string): string {

  const outputHtml = !!workspace
    .getConfiguration("SAS")
    .get("session.outputHtml");
  const htmlStyle: string = workspace
    .getConfiguration("SAS")
    .get("session.htmlStyle");

  if (outputHtml) {
    let odsStyle = "";
    switch (htmlStyle) {
      case "(auto)":
        switch (window.activeColorTheme.kind) {
          case ColorThemeKind.Light: {
            odsStyle = "Illuminate";
            break;
          }
          case ColorThemeKind.Dark: {
            odsStyle = "Ignite";
            break;
          }
          case ColorThemeKind.HighContrast: {
            odsStyle = "HighContrast";
            break;
          }
          case ColorThemeKind.HighContrastLight: {
            odsStyle = "Illuminate";
            break;
          }
        }
        break;
      case "(server default)":
        odsStyle = "";
        break;
      default:
        odsStyle = htmlStyle;
        break;
    }

    let usercode = code;
    code = `ods html5`;
    if (odsStyle) code += ` style=${odsStyle}`;
    code += ";\n" + usercode + "\n;run;quit;ods html5 close;";
  }
  return code;
}
