// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

/**
 * Dictionary is a type that maps a generic object with a string key.
 */
export type Dictionary<T> = {
  [key: string]: T;
};
