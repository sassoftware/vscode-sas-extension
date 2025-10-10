import { Fragment, useRef, useState } from "react";

import { AgColumn } from "ag-grid-community";

export interface ColumnHeaderProps {
  column: AgColumn;
  dismissMenu: () => void;
  hasSort: boolean;
  left: number;
  messages?: Record<string, string>;
  removeAllSorting: () => void;
  removeFromSort: () => void;
  sortColumn: (direction: "asc" | "desc") => void;
  theme: string;
  top: number;
}

interface MenuItem {
  name: string;
  checked?: boolean;
  onPress?: () => void;
  children?: (MenuItem | string)[];
  disabled?: boolean;
}

const GridMenu = ({
  menuItems,
  theme,
  top,
  left,
  subMenu,
}: {
  menuItems: (MenuItem | string)[];
  theme: string;
  top: number;
  left: number;
  subMenu?: boolean;
}) => {
  const menuRef = useRef<HTMLDivElement>(undefined);
  const [subMenuItems, setSubMenuItems] = useState<(MenuItem | string)[]>([]);
  const className = subMenu
    ? `ag-menu ag-ltr ag-popup-child ${theme}`
    : `ag-menu ag-column-menu ag-ltr ag-popup-child ag-popup-positioned-under ${theme}`;
  const [activeIndex, setActiveIndex] = useState(-1);

  return (
    <Fragment>
      {subMenuItems.length > 0 && (
        <GridMenu
          menuItems={subMenuItems}
          theme={theme}
          top={top}
          left={left + menuRef.current.getBoundingClientRect().width}
          subMenu
        />
      )}
      <div className="ag-theme-sas ag-popup">
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
                return (
                  <div
                    className="ag-menu-separator"
                    aria-hidden="true"
                    key={index}
                  >
                    {" "}
                    <div className="ag-menu-separator-part"></div>{" "}
                    <div className="ag-menu-separator-part"></div>{" "}
                    <div className="ag-menu-separator-part"></div>{" "}
                    <div className="ag-menu-separator-part"></div>{" "}
                  </div>
                );
              }
              return (
                <div
                  aria-expanded="false"
                  className={`ag-menu-option ${index === activeIndex ? "ag-menu-option-active" : ""} ${menuItem.disabled ? "ag-menu-option-disabled" : ""}`}
                  role="menuitem"
                  aria-haspopup="menu"
                  tabIndex={-1}
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
                    ).some((t) => t.contains(e.target as HTMLElement));
                    if (!targetInPopup) {
                      setSubMenuItems([]);
                    }
                  }}
                >
                  <span
                    className="ag-menu-option-part ag-menu-option-icon"
                    data-ref="eIcon"
                    role="presentation"
                  >
                    {menuItem.checked && (
                      <span
                        className="ag-icon ag-icon-tick"
                        role="presentation"
                        unselectable="on"
                      ></span>
                    )}
                  </span>
                  <span
                    className="ag-menu-option-part ag-menu-option-text"
                    data-ref="eName"
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
                  <span
                    className="ag-menu-option-part ag-menu-option-shortcut"
                    data-ref="eShortcut"
                  ></span>
                  {menuItem.children && menuItem.children.length > 0 && (
                    <span
                      className="ag-menu-option-part ag-menu-option-popup-pointer"
                      data-ref="ePopupPointer"
                    >
                      <span
                        className="ag-icon ag-icon-small-right"
                        role="presentation"
                        unselectable="on"
                      ></span>
                    </span>
                  )}
                </div>
              );
            })}
            <div
              className="ag-tab-guard ag-tab-guard-bottom"
              role="presentation"
            ></div>
          </div>
        </div>
      </div>
    </Fragment>
  );
};

const ColumnHeaderMenu = ({
  column,
  dismissMenu,
  hasSort,
  left,
  removeAllSorting,
  removeFromSort,
  sortColumn,
  theme,
  top,
  messages: t,
}: ColumnHeaderProps) => {
  const menuItems = [
    {
      name: t["Sort"],
      children: [
        {
          name:
            hasSort && !column.sort
              ? t["Ascending (add to sorting)"]
              : t["Ascending"],
          checked: column.sort === "asc",
          onPress: () => {
            sortColumn("asc");
            dismissMenu();
          },
        },
        {
          name:
            hasSort && !column.sort
              ? t["Descending (add to sorting)"]
              : t["Descending"],
          checked: column.sort === "desc",
          onPress: () => {
            sortColumn("desc");
            dismissMenu();
          },
        },
        "separator",
        {
          name: t["Remove sorting"],
          onPress: () => {
            removeFromSort();
            dismissMenu();
          },
          disabled: !hasSort || !column.sort,
        },
        {
          name: t["Remove all sorting"],
          onPress: () => {
            removeAllSorting();
            dismissMenu();
          },
          disabled: !hasSort,
        },
      ],
    },
  ];

  return <GridMenu menuItems={menuItems} top={top} left={left} theme={theme} />;
};

export default ColumnHeaderMenu;
