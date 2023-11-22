import { readFileSync, writeFileSync } from "fs";
import glob from "glob";
import csv from "papaparse";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagePath = join(__dirname, "..");
const l10nPath = join(__dirname, "..", "l10n");
const csvPath = join(__dirname, "..");

const newLocale = process.env.npm_config_new;
const localeToUpdate = process.env.npm_config_update_locale;
const updateAllLocales = process.env.npm_config_update_locales;
const generateCSV = process.env.npm_config_generate_csv;
const importCSV = process.env.npm_config_import_csv;

const SOURCE_L10N = "l10n";
const SOURCE_NLS = "nls";

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

const getMissingTranslations = (
  newTranslationMap,
  currentTranslationMap,
  source,
) =>
  Object.entries(newTranslationMap)
    .map(([key, value]) => {
      if (currentTranslationMap[key]) {
        return null;
      }

      return {
        Term: key,
        "English text": value,
        Translation: "<add translation here>",
        Source: source,
      };
    })
    .filter((missingTranslation) => !!missingTranslation);

const csvTranslationMap = (source) => {
  if (!importCSV) {
    return {};
  }

  const csvData = readFileSync(join(csvPath, importCSV)).toString();
  const { data } = csv.parse(csvData);
  const headers = data.shift();
  const items = data
    .map((itemArray) =>
      itemArray.reduce(
        (carry, value, idx) => ({
          ...carry,
          [headers[idx]]: value,
        }),
        {},
      ),
    )
    .filter((item) => item.Source === source);

  const translationMap = items.reduce(
    (carry, value) => ({
      ...carry,
      [value.Term]: value.Translation,
    }),
    {},
  );

  return translationMap;
};

const updateLocale = (locale) => {
  const packageNlsPath = join(packagePath, `package.nls.${locale}.json`);
  const l10BundlePath = join(l10nPath, `bundle.l10n.${locale}.json`);

  const newPackageNlsMap = JSON.parse(packageNls);
  const currentPackageNlsMap = JSON.parse(readFileSync(packageNlsPath));
  const currentPackageNlsJSON = {
    ...newPackageNlsMap,
    ...currentPackageNlsMap,
    ...csvTranslationMap(SOURCE_NLS),
  };

  const newL10NBundleMap = JSON.parse(l10nBundle);
  const currentL10NBundleMap = JSON.parse(readFileSync(l10BundlePath));
  const currentL10nBundleJSON = {
    ...newL10NBundleMap,
    ...currentL10NBundleMap,
    ...csvTranslationMap(SOURCE_L10N),
  };

  writeFileSync(packageNlsPath, sortKeys(currentPackageNlsJSON) + "\n");
  writeFileSync(l10BundlePath, sortKeys(currentL10nBundleJSON) + "\n");

  if (generateCSV) {
    const csvEntries = getMissingTranslations(
      newPackageNlsMap,
      currentPackageNlsMap,
      SOURCE_NLS,
    ).concat(
      getMissingTranslations(
        newL10NBundleMap,
        currentL10NBundleMap,
        SOURCE_L10N,
      ),
    );

    if (csvEntries.length > 0) {
      writeFileSync(join(csvPath, generateCSV), csv.unparse(csvEntries));
    }
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
