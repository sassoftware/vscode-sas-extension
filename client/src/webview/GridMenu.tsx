// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState } from "react";

interface MenuItem {
  checked?: boolean;
  children?: (MenuItem | string)[];
  disabled?: boolean;
  name: string;
  onPress?: () => void;
}

const GridMenu = ({
  left: incomingLeft,
  menuItems,
  parentDimensions,
  subMenu,
  theme,
  top,
}: {
  left?: number;
  menuItems: (MenuItem | string)[];
  parentDimensions?: { left: number; width: number };
  subMenu?: boolean;
  theme: string;
  top: number;
}) => {
  const menuRef = useRef<HTMLDivElement>(undefined);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [subMenuItems, setSubMenuItems] = useState<(MenuItem | string)[]>([]);
  const className = subMenu
    ? `ag-menu ag-ltr ag-popup-child ${theme}`
    : `ag-menu ag-column-menu ag-ltr ag-popup-child ag-popup-positioned-under ${theme}`;

  // The following useEffect positions our column header menu. There are three general
  // ways of laying things out.
  // - option 1. If there is enough room for the parent menu and child menu to the right, the
  //.  menus are displayed left to right.
  // - option 2. If the parent menu has enough room, we don't shift it. If the child menu doesn't
  //.  fit to the right, we move it to the left side.
  // - option 3. The parent menu doesn't fit on the screen, so we shift it to the left and
  //   put the child menu on the left side.
  const [left, setLeft] = useState(parentDimensions?.left ?? incomingLeft);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const clientWidth = menuRef.current.closest("body").clientWidth;
    const width = menuRef.current.getBoundingClientRect().width;
    setWidth(width);
    if (parentDimensions) {
      // First, lets put the child menu to the right
      let adjustedLeft = parentDimensions.left + parentDimensions.width;
      // If that's off screen, lets instead place it to the left
      if (adjustedLeft + width > clientWidth) {
        adjustedLeft = parentDimensions.left - width;
      }
      setLeft(adjustedLeft);
      return;
    }
    if (left + width > clientWidth) {
      setLeft(left - (left + width - clientWidth + 15));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {subMenuItems.length > 0 && (
        <GridMenu
          menuItems={subMenuItems}
          parentDimensions={{ left, width }}
          subMenu
          theme={theme}
          top={top}
        />
      )}
      <div
        className="ag-theme-sas ag-popup"
        // We rely on the menu being displayed/having width _first_ before being able to
        // calculate it's correct left position. This prevents actually showing the
        // menu to the user until we've figured that out. This prevents flashes of the
        // menu in the wrong position.
        style={{ visibility: width ? "visible" : "hidden" }}
      >
        <div
          className={className}
          role="presentation"
          style={{ top, left }}
          ref={menuRef}
        >
          <div className="ag-menu-list ag-focus-managed" role="menu">
            <div
              className="ag-tab-guard ag-tab-guard-top"
              role="presentation"
            ></div>
            {menuItems.map((menuItem, index) => {
              if (typeof menuItem === "string") {
                return <Separator key={index} />;
              }
              return (
                <div
                  aria-expanded="false"
                  className={`ag-menu-option ${index === activeIndex ? "ag-menu-option-active" : ""} ${menuItem.disabled ? "ag-menu-option-disabled" : ""}`}
                  role="menuitem"
                  aria-haspopup="menu"
                  key={menuItem.name}
                  onMouseEnter={() => {
                    if (menuItem.disabled) {
                      return;
                    }
                    setActiveIndex(index);
                    if (menuItem.children) {
                      setSubMenuItems(menuItem.children);
                    } else {
                      setSubMenuItems([]);
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (menuItem.disabled) {
                      return;
                    }
                    setActiveIndex(-1);
                    const targetInPopup = Array.from(
                      document.querySelectorAll(".ag-popup"),
                      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                    ).some((t) => t.contains(e.target as HTMLElement));
                    if (!targetInPopup) {
                      setSubMenuItems([]);
                    }
                  }}
                >
                  <span
                    className="ag-menu-option-part ag-menu-option-icon"
                    role="presentation"
                  >
                    {menuItem.checked && (
                      <span
                        className="ag-icon ag-icon-tick"
                        role="presentation"
                      />
                    )}
                  </span>
                  <span
                    className="ag-menu-option-part ag-menu-option-text"
                    onClick={() => {
                      if (menuItem.disabled) {
                        return;
                      }
                      if (menuItem.onPress) {
                        return menuItem.onPress();
                      }
                      if (menuItem.children) {
                        setSubMenuItems(menuItem.children);
                      }
                    }}
                  >
                    {menuItem.name}
                  </span>
                  <span className="ag-menu-option-part ag-menu-option-shortcut"></span>
                  <span className="ag-menu-option-part ag-menu-option-popup-pointer">
                    {menuItem.children && menuItem.children.length > 0 && (
                      <span
                        className="ag-icon ag-icon-small-right"
                        role="presentation"
                      />
                    )}
                  </span>
                </div>
              );
            })}
            <div
              className="ag-tab-guard ag-tab-guard-bottom"
              role="presentation"
            />
          </div>
        </div>
      </div>
    </>
  );
};

const Separator = () => (
  <div className="ag-menu-separator" aria-hidden="true">
    {" "}
    <div className="ag-menu-separator-part"></div>{" "}
    <div className="ag-menu-separator-part"></div>{" "}
    <div className="ag-menu-separator-part"></div>{" "}
    <div className="ag-menu-separator-part"></div>{" "}
  </div>
);

export default GridMenu;
