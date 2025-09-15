import { Fragment, useRef, useState } from "react";

import { AgColumn } from "ag-grid-community";

export interface ColumnHeaderProps {
  left: number;
  top: number;
  column: AgColumn;
  sortColumn: (direction: "asc" | "desc") => void;
  dismissMenu: () => void;
  theme: string;
}

interface MenuItem {
  name: string;
  checked?: boolean;
  onPress?: () => void;
  children?: (MenuItem | string)[];
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
                className="ag-menu-list ag-focus-managed"
                role="menu"
                key={menuItem.name}
              >
                <div
                  className="ag-tab-guard ag-tab-guard-top"
                  role="presentation"
                ></div>
                <div
                  aria-expanded="false"
                  className="ag-menu-option"
                  role="menuitem"
                  aria-haspopup="menu"
                  tabIndex={-1}
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
                <div
                  className="ag-tab-guard ag-tab-guard-bottom"
                  role="presentation"
                ></div>
              </div>
            );
          })}
        </div>
      </div>
    </Fragment>
  );
};

const ColumnHeaderMenu = ({
  left,
  top,
  column,
  sortColumn,
  dismissMenu,
  theme,
}: ColumnHeaderProps) => {
  const menuItems = [
    {
      name: "Sort",
      children: [
        {
          name: "Ascending",
          checked: column.sort === "asc",
          onPress: () => {
            sortColumn(column.sort === "asc" ? null : "asc");
            dismissMenu();
          },
        },
        {
          name: "Descending",
          checked: column.sort === "desc",
          onPress: () => {
            sortColumn(column.sort === "desc" ? null : "desc");
            dismissMenu();
          },
        },
        "separator",
        {
          name: "Remove Sorting",
        },
        {
          name: "Remove all sorting",
        },
      ],
    },
  ];

  if (1 === 1) {
    return (
      <GridMenu menuItems={menuItems} top={top} left={left} theme={theme} />
    );
  }
  return (
    <div className="header-menu" style={{ left, top }}>
      <ul>
        <li>
          <span>Sort</span>
          <ul>
            <li>
              {column.sort === "asc" && <span>✓ </span>}
              <button
                type="button"
                onClick={() => {
                  sortColumn(column.sort === "asc" ? null : "asc");
                  dismissMenu();
                }}
              >
                Ascending
              </button>
            </li>
            <li>
              {column.sort === "desc" && <span>✓ </span>}
              <button
                type="button"
                onClick={() => {
                  sortColumn(column.sort === "desc" ? null : "desc");
                  dismissMenu();
                }}
              >
                Descending
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  );
};

export default ColumnHeaderMenu;
