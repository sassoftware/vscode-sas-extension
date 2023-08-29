import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const newLocale = process.env.npm_config_new;
const localeToUpdate = process.env.npm_config_update;

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

  const currentPackageNlsJSON = JSON.parse(readFileSync(packageNlsPath));
  const currentL10nBundleJSON = JSON.parse(readFileSync(l10BundlePath));

  const packageNlsJSON = JSON.parse(packageNls);
  Object.keys(packageNlsJSON).forEach((key) => {
    if (!currentPackageNlsJSON[key]) {
      currentPackageNlsJSON[key] = packageNlsJSON[key];
    }
  });

  const l10nBundleJSON = JSON.parse(l10nBundle);
  Object.keys(l10nBundleJSON).forEach((key) => {
    if (!currentL10nBundleJSON[key]) {
      currentL10nBundleJSON[key] = l10nBundleJSON[key];
    }
  });

  writeFileSync(packageNlsPath, sortKeys(currentPackageNlsJSON));
  writeFileSync(l10BundlePath, sortKeys(currentL10nBundleJSON));
}
