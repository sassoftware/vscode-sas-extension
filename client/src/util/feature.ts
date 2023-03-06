import { workspace } from "vscode";

export const featureEnabled = (featureName: string) => {
  const features = workspace.getConfiguration("SAS").get("feature");

  return !!features[featureName];
};
