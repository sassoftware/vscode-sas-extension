import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(__dirname, "..", "l10n", "bundle.l10n.json");

const bundle = JSON.parse(readFileSync(bundlePath).toString());
const sorted = Object.fromEntries(
  Object.keys(bundle)
    .sort()
    .map((key) => [key, bundle[key]]),
);

writeFileSync(bundlePath, JSON.stringify(sorted, null, "  ") + "\n");
