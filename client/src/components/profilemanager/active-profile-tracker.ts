// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import * as activeValueTracker from "./active-value-tracker";
import { ActiveValueTracker } from "./active-value-tracker";
import { getSelectedProfile } from "../../viya/profile";

const ACTIVE_CONTEXT_POLL_INTERVAL_MS = 60 * 1000;

export function create(): ActiveValueTracker<string | null> {
    return activeValueTracker.create(() => getActiveProfileName(), ACTIVE_CONTEXT_POLL_INTERVAL_MS);
}

async function getActiveProfileName(): Promise<string | null> {
    const name, profile = await getSelectedProfile();
    if (!name || !profile) {
        return null;
    }
    return name;
}