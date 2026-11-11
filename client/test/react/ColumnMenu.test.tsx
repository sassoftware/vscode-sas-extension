import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AgColumn } from "ag-grid-community";
import { expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";

import type { ColumnMenuProps } from "../../src/webview/ColumnMenu";

const mockUseTheme = sinon.stub().returns("test-theme");
const mockApplyColumnState = sinon.stub();

// Load ColumnMenu with its dependencies mocked.
const { default: ColumnMenu }: typeof import("../../src/webview/ColumnMenu") =
  proxyquire.noCallThru()("../../src/webview/ColumnMenu", {
    "./useTheme": {
      __esModule: true,
      default: mockUseTheme,
    },
    "./useDataViewer": {
      applyColumnState: mockApplyColumnState,
    },
  });

const createColumn = (): AgColumn => {
  const column = sinon.createStubInstance(AgColumn);

  Object.defineProperty(column, "colId", {
    configurable: true,
    value: "col1",
  });

  column.getSort.returns(null);
  column.getPinned.returns(null);

  return column;
};

const createProps = () => {
  const dismissMenu = sinon.stub();
  const loadColumnProperties = sinon.stub();
  const pinColumn = sinon.stub();
  const removeAllSorting = sinon.stub();
  const removeFromSort = sinon.stub();
  const sortColumn = sinon.stub();
  const onManageColumns = sinon.stub();

  const props: ColumnMenuProps = {
    column: createColumn(),
    dismissMenu,
    hasSort: false,
    left: 10,
    loadColumnProperties,
    onManageColumns,
    pinColumn,
    removeAllSorting,
    removeFromSort,
    sortColumn,
    top: 20,
  };

  return {
    props,
    dismissMenu,
    loadColumnProperties,
    pinColumn,
    removeAllSorting,
    removeFromSort,
    sortColumn,
    onManageColumns,
  };
};

describe("ColumnMenu", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockUseTheme.resetHistory();
    mockApplyColumnState.resetHistory();

    Object.defineProperty(document.body, "clientWidth", {
      configurable: true,
      value: 1000,
    });

    sandbox
      .stub(HTMLElement.prototype, "getBoundingClientRect")
      .returns(new DOMRect(0, 0, 200, 100));
  });

  afterEach(() => {
    cleanup();
    sandbox.restore();
  });

  it("renders the Manage Columns menu item", () => {
    const menu = createProps();

    render(<ColumnMenu {...menu.props} />);

    expect(screen.getByText("Manage Columns")).to.exist;
  });

  it("calls onManageColumns when Manage Columns is selected", () => {
    const menu = createProps();

    render(<ColumnMenu {...menu.props} />);

    fireEvent.click(screen.getByText("Manage Columns"));

    expect(menu.onManageColumns.calledOnce).to.equal(true);
  });
});
