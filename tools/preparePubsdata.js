/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");

const dirs = [
  "../server/pubsdata/Procedures/en",
  "../server/pubsdata/Statements/en",
  "../server/pubsdata/Functions/en",
];

function convert(str) {
  if (str.indexOf("\n") !== -1) {
    // multi-lines, no style can be applied
    return str
      .replace(/<i>|<\/i>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }
  return str.replace(/<i>\s*|\s*<\/i>/g, "*");
}

function gothrough(syntax) {
  for (const data of syntax) {
    if (data.arguments) gothrough(data.arguments);
    if (data.syntax && data.syntax.arguments) gothrough(data.syntax.arguments);
    if (data.help) data.help = convert(data.help);
    if (data.syntax && data.syntax.help)
      data.syntax.help = convert(data.syntax.help);
  }
}

for (const dir of dirs) {
  fs.readdir(dir, (err, files) => {
    for (const file of files) {
      fs.readFile(path.join(dir, file), (err, data) => {
        const syntax = JSON.parse(data);
        gothrough(syntax.statements ? syntax.statements : syntax);
        fs.writeFileSync(path.join(dir, file), JSON.stringify(syntax));
      });
    }
  });
}
