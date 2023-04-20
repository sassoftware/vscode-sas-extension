// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

// This declares a global type for DedicatedWorkerGlobalScope which
// doesn't exist in the DOM library. This is necessary because there are conflicts
// when including both DOM & WebWorker. See https://github.com/microsoft/TypeScript/issues/20595
// for more information.
declare global {
  type DedicatedWorkerGlobalScope = Worker;
}

export {};
