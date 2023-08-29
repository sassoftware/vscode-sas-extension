import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const newLocale = process.env.npm_config_new;
const localeToUpdate = process.env.npm_config_update_locale;

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

if (newLocale) {
  writeFileSync(
    join(__dirname, "..", `package.nls.${newLocale}.json`),
    sortKeys(packageNls),
  );

  writeFileSync(
    join(__dirname, "..", "l10n", `bundle.l10n.${newLocale}.json`),
    sortKeys(l10nBundle),
  );
}

if (localeToUpdate) {
  const packageNlsPath = join(
    __dirname,
    "..",
    `package.nls.${localeToUpdate}.json`,
  );
  const l10BundlePath = join(
    __dirname,
    "..",
    "l10n",
    `bundle.l10n.${localeToUpdate}.json`,
  );

  const currentPackageNlsJSON = {
    ...JSON.parse(packageNls),
    ...JSON.parse(readFileSync(packageNlsPath)),
  };
  const currentL10nBundleJSON = {
    ...JSON.parse(l10nBundle),
    ...JSON.parse(readFileSync(l10BundlePath)),
  };

  writeFileSync(packageNlsPath, sortKeys(currentPackageNlsJSON));
  writeFileSync(l10BundlePath, sortKeys(currentL10nBundleJSON));
}
