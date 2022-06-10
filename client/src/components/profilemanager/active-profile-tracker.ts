// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { ProfileConfig } from '../../viya/profile';
import * as activeValueTracker from "./active-value-tracker";
import { ActiveValueTracker } from "./active-value-tracker";

const ACTIVE_PROFILE_POLL_INTERVAL_MS = 60 * 1000;

export function create(profileConfig: ProfileConfig): ActiveValueTracker<string | null> {
  return activeValueTracker.create(() => getActiveProfileName(profileConfig), ACTIVE_PROFILE_POLL_INTERVAL_MS);
}

async function getActiveProfileName(profileConfig: ProfileConfig): Promise<string | null> {
    const profile = await profileConfig.getActiveProfile();
    if (!profile) {
        return null;
    }
    return profile.name;
}