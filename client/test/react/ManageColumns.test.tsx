import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { ColumnState } from "ag-grid-community";
import { expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";

import type { ManageColumnsProps } from "../../src/webview/ManageColumns/ManageColumns";

// Mock the layout/drag/resize hooks so this suite can focus on
// Manage Columns behavior rather than browser layout calculations.
const useResponsiveDialog = sinon.stub();

const useDraggableDialog = sinon.stub().callsFake(() => ({
  handleDragStart: sinon.stub(),
  handleDrag: sinon.stub(),
  handleDragEnd: sinon.stub(),
}));

const useColumnPanelResize = sinon.stub().callsFake(() => ({
  leftPanelRef: { current: null },
  rightPanelRef: { current: null },
  handleResizeStart: sinon.stub(),
  handleResize: sinon.stub(),
  handleResizeEnd: sinon.stub(),
  handleResizeKeyDown: sinon.stub(),
}));

// Proxyquire replaces imported hooks before ManageColumns is loaded.
// __esModule ensures the compiled default imports resolve correctly.
const {
  default: ManageColumns,
}: typeof import("../../src/webview/ManageColumns/ManageColumns") =
  proxyquire.noCallThru()("../../src/webview/ManageColumns/ManageColumns", {
    "./useResponsiveDialog": {
      __esModule: true,
      default: useResponsiveDialog,
    },
    "./useDraggableDialog": {
      __esModule: true,
      default: useDraggableDialog,
    },
    "./useColumnPanelResize": {
      __esModule: true,
      default: useColumnPanelResize,
    },
    "./ManageColumns.css": {
      "@noCallThru": true,
    },
  });

const column = (colId: string, hide = false): ColumnState => ({
  colId,
  hide,
});

const defaultColumnState: ColumnState[] = [
  column("#"),
  column("col1"),
  column("col2"),
  column("col3", true),
  column("col4", true),
];

const createProps = (
  overrides: Partial<ManageColumnsProps> = {},
): ManageColumnsProps => ({
  columnState: defaultColumnState.map((item) => ({ ...item })),
  onClose: sinon.stub(),
  onApply: sinon.stub(),
  ...overrides,
});

const renderDialog = (overrides: Partial<ManageColumnsProps> = {}) => {
  const props = createProps(overrides);

  render(
    <div className="data-viewer">
      <ManageColumns {...props} />
    </div>,
  );

  return props;
};

const getDisplayedList = () =>
  screen.getByRole("listbox", { name: "Displayed columns" });

const getHiddenList = () =>
  screen.getByRole("listbox", { name: "Hidden columns" });

const getColumnNames = (list: HTMLElement): string[] =>
  within(list)
    .getAllByRole("option")
    .map((element) => element.textContent?.trim() ?? "");

// Find the filter belonging to the requested column list.
const getFilter = (list: HTMLElement): HTMLElement => {
  const panel = list.closest(".columns-section-outer");

  if (!(panel instanceof HTMLElement)) {
    throw new Error("Columns panel was not found");
  }

  return within(panel).getByRole("textbox", {
    name: "Filter",
  });
};

const getClearButton = (list: HTMLElement): HTMLElement => {
  const panel = list.closest(".columns-section-outer");

  if (!(panel instanceof HTMLElement)) {
    throw new Error("Columns panel was not found");
  }

  return within(panel).getByRole("button", {
    name: "Clear",
  });
};

describe("ManageColumns", () => {
  beforeEach(() => {
    useResponsiveDialog.resetHistory();
    useDraggableDialog.resetHistory();
    useColumnPanelResize.resetHistory();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the Manage Columns dialog", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Manage Columns" })).to.exist;

    expect(getDisplayedList()).to.exist;
    expect(getHiddenList()).to.exist;

    expect(
      screen.getByRole("button", { name: "OK" }).hasAttribute("disabled"),
    ).to.equal(true);
  });

  it("displays visible and hidden columns correctly", () => {
    renderDialog();

    expect(getColumnNames(getDisplayedList())).to.deep.equal(["col1", "col2"]);

    expect(getColumnNames(getHiddenList())).to.deep.equal(["col3", "col4"]);

    // The row number column should not be manageable.
    expect(screen.queryByRole("option", { name: "#" })).to.equal(null);
  });

  it("filters hidden columns and clears the filter", () => {
    renderDialog();

    const hiddenList = getHiddenList();
    const filter = getFilter(hiddenList);

    fireEvent.change(filter, {
      target: { value: "col3" },
    });

    expect(getColumnNames(getHiddenList())).to.deep.equal(["col3"]);

    expect(
      within(getHiddenList()).queryByRole("option", {
        name: "col4",
      }),
    ).to.equal(null);

    fireEvent.click(getClearButton(getHiddenList()));

    expect(getColumnNames(getHiddenList())).to.deep.equal(["col3", "col4"]);
  });

  it("filters displayed columns and clears the filter", () => {
    renderDialog();

    const displayedList = getDisplayedList();
    const filter = getFilter(displayedList);

    fireEvent.change(filter, {
      target: { value: "col1" },
    });

    expect(getColumnNames(getDisplayedList())).to.deep.equal(["col1"]);

    expect(
      within(getDisplayedList()).queryByRole("option", {
        name: "col2",
      }),
    ).to.equal(null);

    fireEvent.click(getClearButton(getDisplayedList()));

    expect(getColumnNames(getDisplayedList())).to.deep.equal(["col1", "col2"]);
  });

  it("moves a selected hidden column to displayed columns", () => {
    renderDialog();

    fireEvent.click(
      within(getHiddenList()).getByRole("option", {
        name: "col3",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(getColumnNames(getDisplayedList())).to.deep.equal([
      "col1",
      "col2",
      "col3",
    ]);

    expect(getColumnNames(getHiddenList())).to.deep.equal(["col4"]);

    expect(
      screen.getByRole("button", { name: "OK" }).hasAttribute("disabled"),
    ).to.equal(false);
  });

  it("moves a selected displayed column to hidden columns", () => {
    renderDialog();

    fireEvent.click(
      within(getDisplayedList()).getByRole("option", {
        name: "col2",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(getColumnNames(getDisplayedList())).to.deep.equal(["col1"]);

    expect(getColumnNames(getHiddenList())).to.deep.equal([
      "col2",
      "col3",
      "col4",
    ]);
  });

  it("moves only filtered hidden columns when Add all is clicked", () => {
    renderDialog();

    fireEvent.change(getFilter(getHiddenList()), {
      target: { value: "col3" },
    });

    expect(getColumnNames(getHiddenList())).to.deep.equal(["col3"]);

    fireEvent.click(screen.getByRole("button", { name: "Add all" }));

    expect(getColumnNames(getDisplayedList())).to.deep.equal([
      "col1",
      "col2",
      "col3",
    ]);

    expect(screen.getByLabelText("Hidden columns: No items are available.")).to
      .exist;

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(getColumnNames(getHiddenList())).to.deep.equal(["col4"]);

    expect(
      within(getHiddenList()).queryByRole("option", {
        name: "col3",
      }),
    ).to.equal(null);
  });

  it("moves only filtered displayed columns when Remove all is clicked", () => {
    renderDialog();

    fireEvent.change(getFilter(getDisplayedList()), {
      target: { value: "col1" },
    });

    expect(getColumnNames(getDisplayedList())).to.deep.equal(["col1"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove all" }));

    expect(getColumnNames(getHiddenList())).to.deep.equal([
      "col1",
      "col3",
      "col4",
    ]);

    expect(screen.getByLabelText("Displayed columns: No items are available."))
      .to.exist;

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(getColumnNames(getDisplayedList())).to.deep.equal(["col2"]);

    expect(
      within(getDisplayedList()).queryByRole("option", {
        name: "col1",
      }),
    ).to.equal(null);
  });

  it("applies modified column state when OK is clicked", () => {
    const onApply: sinon.SinonStub<[ColumnState[]], void> = sinon.stub();

    renderDialog({ onApply });

    fireEvent.click(
      within(getHiddenList()).getByRole("option", {
        name: "col3",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onApply.calledOnce).to.equal(true);

    const updatedState = onApply.firstCall.args[0];

    expect(updatedState.map((item) => item.colId)).to.deep.equal([
      "col1",
      "col2",
      "col3",
      "col4",
    ]);

    expect(updatedState.find((item) => item.colId === "col3")?.hide).to.equal(
      false,
    );

    expect(updatedState.find((item) => item.colId === "col4")?.hide).to.equal(
      true,
    );
  });

  it("closes without applying changes when Cancel is clicked", () => {
    const onClose = sinon.stub();
    const onApply = sinon.stub();

    renderDialog({ onClose, onApply });

    fireEvent.click(
      within(getHiddenList()).getByRole("option", {
        name: "col3",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose.calledOnce).to.equal(true);
    expect(onApply.called).to.equal(false);
  });

  it("closes when the dialog close button is clicked", () => {
    const onClose = sinon.stub();
    const onApply = sinon.stub();

    renderDialog({ onClose, onApply });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose.calledOnce).to.equal(true);
    expect(onApply.called).to.equal(false);
  });

  it("restores the original columns when Undo is clicked", () => {
    renderDialog();

    fireEvent.click(
      within(getHiddenList()).getByRole("option", {
        name: "col3",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const undoButton = screen.getByRole("button", {
      name: "Undo",
    });

    expect(undoButton.hasAttribute("disabled")).to.equal(false);

    fireEvent.click(undoButton);

    expect(getColumnNames(getDisplayedList())).to.deep.equal(["col1", "col2"]);

    expect(getColumnNames(getHiddenList())).to.deep.equal(["col3", "col4"]);

    expect(
      screen.getByRole("button", { name: "OK" }).hasAttribute("disabled"),
    ).to.equal(true);
  });

  it("reorders a selected displayed column upward", () => {
    renderDialog();

    fireEvent.click(
      within(getDisplayedList()).getByRole("option", {
        name: "col2",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Move up" }));

    expect(getColumnNames(getDisplayedList())).to.deep.equal(["col2", "col1"]);
  });

  it("moves a displayed column down and applies the new order", () => {
    const onApply: sinon.SinonStub<[ColumnState[]], void> = sinon.stub();

    renderDialog({ onApply });

    fireEvent.click(
      within(getDisplayedList()).getByRole("option", {
        name: "col1",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Move down" }));

    expect(getColumnNames(getDisplayedList())).to.deep.equal(["col2", "col1"]);

    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onApply.calledOnce).to.equal(true);

    expect(onApply.firstCall.args[0]).to.deep.equal([
      column("col2"),
      column("col1"),
      column("col3", true),
      column("col4", true),
    ]);
  });

  it("uses the mocked layout hooks", () => {
    renderDialog();

    expect(useResponsiveDialog.calledOnce).to.equal(true);
    expect(useDraggableDialog.calledOnce).to.equal(true);
    expect(useColumnPanelResize.calledOnce).to.equal(true);
  });
});
