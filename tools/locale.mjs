import { readFileSync, writeFileSync } from "fs";
import glob from "glob";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = join(__dirname, "..");
const l10nPath = join(__dirname, "..", "l10n");

const newLocale = process.env.npm_config_new;
const localeToUpdate = process.env.npm_config_update_locale;
const updateAllLocales = process.env.npm_config_update_locales;
const generateCSV = process.env.npm_config_generate_csv;

const sortKeys = (content) => {
  const contentJSON =
    typeof content === "string" ? JSON.parse(content) : content;
  const orderedResults = Object.keys(contentJSON)
    .sort()
    .reduce(function (result, key) {
      result[key] = contentJSON[key];
      return result;
    }, {});

  return JSON.stringify(orderedResults, null, "  ");
};

const packageNls = readFileSync(
  join(packagePath, "package.nls.json"),
).toString();
const l10nBundle = readFileSync(join(l10nPath, "bundle.l10n.json")).toString();

const stringArrayToCsvString = (strings) =>
  `"${strings
    .map((item) => (item ?? "").toString().replace(/"/g, '""'))
    .join('","')}"`;
const convertToCSV = (items) => {
  const headers = Object.keys(items[0]);
  return [stringArrayToCsvString(headers)]
    .concat(
      items.map((item) =>
        stringArrayToCsvString(headers.map((header) => item[header])),
      ),
    )
    .join("\n");
};

const updateLocale = (locale) => {
  const packageNlsPath = join(packagePath, `package.nls.${locale}.json`);
  const l10BundlePath = join(l10nPath, `bundle.l10n.${locale}.json`);

  const newPackageNlsMap = JSON.parse(packageNls);
  const currentPackageNlsMap = JSON.parse(readFileSync(packageNlsPath));
  const currentPackageNlsJSON = {
    ...newPackageNlsMap,
    ...currentPackageNlsMap,
  };

  const newL10NBundleMap = JSON.parse(l10nBundle);
  const currentL10NBundleMap = JSON.parse(readFileSync(l10BundlePath));
  const currentL10nBundleJSON = {
    ...newL10NBundleMap,
    ...currentL10NBundleMap,
  };

  writeFileSync(packageNlsPath, sortKeys(currentPackageNlsJSON) + "\n");
  writeFileSync(l10BundlePath, sortKeys(currentL10nBundleJSON) + "\n");
  if (generateCSV) {
    const csvEntries = [];
    Object.entries(newPackageNlsMap)
      .concat(Object.entries(newL10NBundleMap))
      .forEach(([key, value]) => {
        if (!currentL10NBundleMap[key] && !currentPackageNlsMap[key]) {
          csvEntries.push({
            Term: key,
            "English text": value,
            Translation: "<add translation here>",
          });
        }
      });

    writeFileSync(join(__dirname, generateCSV), convertToCSV(csvEntries));
  }
};

if (newLocale) {
  writeFileSync(
    join(packagePath, `package.nls.${newLocale}.json`),
    sortKeys(packageNls) + "\n",
  );

  writeFileSync(
    join(l10nPath, `bundle.l10n.${newLocale}.json`),
    sortKeys(l10nBundle) + "\n",
  );
}

if (localeToUpdate) {
  updateLocale(localeToUpdate);
}

if (updateAllLocales) {
  const packageNlsFiles = glob.sync(join(packagePath, "package.nls.*.json"));

  const locales = packageNlsFiles.map(
    (filePath) => filePath.match(/package\.nls\.(.*)\.json/)[1],
  );

  locales.forEach((locale) => updateLocale(locale));
}
