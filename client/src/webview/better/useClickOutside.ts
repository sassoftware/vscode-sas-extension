// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Close a popover/menu when the user clicks outside its ref or presses Escape.
// Shared by the toolbar DropMenu and the header FilterPopup — both render
// through portals where a trigger's onBlur is unreliable (mousedown→blur→click
// race closes the menu before the item's click lands).
import { type RefObject, useEffect } from "react";

export function useClickOutside(
  ref: RefObject<HTMLElement>,
  onDismiss: () => void,
  active = true,
): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (
        ref.current &&
        e.target instanceof Node &&
        !ref.current.contains(e.target)
      ) {
        onDismiss();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, ref, onDismiss]);
}
