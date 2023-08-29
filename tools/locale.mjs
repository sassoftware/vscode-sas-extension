import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import glob from "glob";

const __dirname = dirname(fileURLToPath(import.meta.url));

const newLocale = process.env.npm_config_new;
const localeToUpdate = process.env.npm_config_update_locale;
const updateAllLocales = process.env.npm_config_update_locales;

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

const packageNls = readFileSync(join(__dirname, "..", "package.nls.json"));
const l10nBundle = readFileSync(
  join(__dirname, "..", "l10n", "bundle.l10n.json"),
);

const updateLocale = (locale) => {
  const packageNlsPath = join(__dirname, "..", `package.nls.${locale}.json`);
  const l10BundlePath = join(
    __dirname,
    "..",
    "l10n",
    `bundle.l10n.${locale}.json`,
  );

  const currentPackageNlsJSON = {
    ...JSON.parse(packageNls),
    ...JSON.parse(readFileSync(packageNlsPath)),
  };
  const currentL10nBundleJSON = {
    ...JSON.parse(l10nBundle),
    ...JSON.parse(readFileSync(l10BundlePath)),
  };

  writeFileSync(packageNlsPath, sortKeys(currentPackageNlsJSON) + "\n");
  writeFileSync(l10BundlePath, sortKeys(currentL10nBundleJSON) + "\n");
};

if (newLocale) {
  writeFileSync(
    join(__dirname, "..", `package.nls.${newLocale}.json`),
    sortKeys(packageNls) + "\n",
  );

  writeFileSync(
    join(__dirname, "..", "l10n", `bundle.l10n.${newLocale}.json`),
    sortKeys(l10nBundle) + "\n",
  );
}

if (localeToUpdate) {
  updateLocale(localeToUpdate);
}

if (updateAllLocales) {
  const packageNlsFiles = glob.sync(
    join(__dirname, "..", "package.nls.*.json"),
  );

  const locales = packageNlsFiles.map(
    (filePath) => filePath.match(/package\.nls\.(.*)\.json/)[1],
  );

  locales.forEach((locale) => updateLocale(locale));
}
