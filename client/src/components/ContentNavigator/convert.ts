import * as fs from "fs";

export function convert_sasnb_to_flw(
  filePath: string,
): { code: string; language: string }[] {
  const codeList = [];

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const notebookContent = JSON.parse(content);

    for (const cell of notebookContent) {
      let code = cell.value;
      if (code !== "") {
        let language = cell.language;
        if (language === "sql") {
          language = "sas";
          code = `
          PROC SQL;
              ${code}
              ;
          QUIT;
          RUN;
          `;
        }
        codeList.push({ code, language });
      }
    }
  } catch (error) {
    console.error("Error reading or parsing the .sasnb file:", error);
  }

  return codeList;
}
