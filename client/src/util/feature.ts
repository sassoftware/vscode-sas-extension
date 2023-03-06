// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { workspace } from "vscode";

export const featureEnabled = (featureName: string) => {
  const features = workspace.getConfiguration("SAS").get("feature");

  return !!features[featureName];
};
