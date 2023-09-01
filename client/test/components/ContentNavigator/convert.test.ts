// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { convertNotebookToFlow } from "../../../src/components/ContentNavigator/convert";
import { deepEqual } from "assert";
import { workspace } from "vscode";
import { getTestFixtureContent } from "../../utils";

function parseFlowData(flowDataString) {
  const flowData = JSON.parse(
    flowDataString
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/\r/g, "\\r"),
  );
  return flowData;
}

function removeIdsNodes(flowData) {
  flowData.creationTimeStamp = "";
  flowData.modifiedTimeStamp = "";
  flowData.createdBy = "";
  flowData.modifiedBy = "";
  flowData.links = [];
  flowData.name = "test.flw";
  const keys = Object.keys(flowData.nodes);
  for (let i = 0; i < keys.length; i++) {
    const newKey = "IDNODE" + i.toString();
    const oldKey = keys[i];
    flowData.nodes[newKey] = flowData.nodes[oldKey];
    delete flowData.nodes[oldKey];
    flowData.nodes[newKey].id = newKey;
    flowData.nodes[newKey].note.id = "IDNOTE" + i.toString();
    flowData.nodes[newKey].properties.UI_PROP_NODE_DATA_MODIFIED_DATE = "";
  }
  if (flowData.connections.length === 2) {
    flowData.connections[0].sourcePort.node = "IDNODE0";
    flowData.connections[0].targetPort.node = "IDNODE1";
    flowData.connections[1].sourcePort.node = "IDNODE1";
    flowData.connections[1].targetPort.node = "IDNODE2";
  } else if (flowData.connections.length === 1) {
    flowData.connections[0].sourcePort.node = "IDNODE0";
    flowData.connections[0].targetPort.node = "IDNODE1";
  } else {
    flowData.connections = [];
  }
  return flowData;
}

function removeIdsSwimlanes(flowData) {
  flowData.creationTimeStamp = "";
  flowData.modifiedTimeStamp = "";
  flowData.createdBy = "";
  flowData.modifiedBy = "";
  flowData.links = [];
  flowData.name = "test.flw";
  const keys = Object.keys(flowData.nodes);
  for (let i = 0; i < keys.length; i++) {
    const newKey = "IDSWIMLANE" + i.toString();
    const oldKey = keys[i];
    flowData.nodes[newKey] = flowData.nodes[oldKey];
    delete flowData.nodes[oldKey];
    flowData.nodes[newKey].id = newKey;
    flowData.nodes[newKey].dataFlowAndBindings.dataFlow.creationTimeStamp = "";
    flowData.nodes[newKey].dataFlowAndBindings.dataFlow.modifiedTimeStamp = "";
    flowData.nodes[newKey].dataFlowAndBindings.dataFlow.createdBy = "";
    flowData.nodes[newKey].dataFlowAndBindings.dataFlow.modifiedBy = "";
    flowData.nodes[newKey].dataFlowAndBindings.dataFlow.links = [];
    const nodeKeys = Object.keys(
      flowData.nodes[newKey].dataFlowAndBindings.dataFlow.nodes,
    );
    for (let j = 0; j < nodeKeys.length; j++) {
      const newNodeKey = "IDNODE" + i.toString() + j.toString();
      const oldNodeKey = nodeKeys[j];
      flowData.nodes[newKey].dataFlowAndBindings.dataFlow.nodes[newNodeKey] =
        flowData.nodes[newKey].dataFlowAndBindings.dataFlow.nodes[oldNodeKey];
      delete flowData.nodes[newKey].dataFlowAndBindings.dataFlow.nodes[
        oldNodeKey
      ];
      flowData.nodes[newKey].dataFlowAndBindings.dataFlow.nodes[newNodeKey].id =
        newNodeKey;
      flowData.nodes[newKey].dataFlowAndBindings.dataFlow.nodes[
        newNodeKey
      ].note.id = "IDNOTE" + i.toString() + j.toString();
      flowData.nodes[newKey].dataFlowAndBindings.dataFlow.nodes[
        newNodeKey
      ].properties.UI_PROP_NODE_DATA_MODIFIED_DATE = "";
    }
  }
  return flowData;
}

function removeIds(flowData, mode) {
  if (mode === "Node") {
    return removeIdsNodes(flowData);
  }
  return removeIdsSwimlanes(flowData);
}

function convertAndRemoveIds(inputContent, inputName, expectedFlowData, mode) {
  const flowDataString = convertNotebookToFlow(
    inputContent,
    inputName,
    "test.flw",
  );
  let flowDataNode = parseFlowData(flowDataString);
  flowDataNode = removeIds(flowDataNode, mode);
  let expectedflowDataOut = {};
  if (typeof expectedFlowData === "string") {
    expectedflowDataOut = parseFlowData(expectedFlowData);
    expectedflowDataOut = removeIds(expectedflowDataOut, mode);
  } else {
    expectedflowDataOut = removeIds(expectedFlowData, mode);
  }
  return [flowDataNode, expectedflowDataOut];
}

async function updateWorkspaceSettings(Mode) {
  const configuration = workspace.getConfiguration(); // Get the workspace configuration
  await configuration.update("SAS.flowConversionMode", Mode, true);
}

describe("Notebook Conversion", async () => {
  it("convert the multi cell sas notebook to node flow", async () => {
    await updateWorkspaceSettings("Node");
    const contentSASNotebookMulti =
      getTestFixtureContent("test_multi.sasnb").toString();
    const flowDataSASNotebookMulti = getTestFixtureContent(
      "test_multi_node.flw",
    ).toString();
    const [flowDataActual, flowDataExpected] = convertAndRemoveIds(
      contentSASNotebookMulti,
      "test.sasnb",
      flowDataSASNotebookMulti,
      workspace.getConfiguration().get("SAS.flowConversionMode"),
    );
    deepEqual(flowDataActual, flowDataExpected, "The flow data is not correct");
  });

  it("convert the single cell sas notebook to node flow", async () => {
    await updateWorkspaceSettings("Node");
    const contentSASNotebookSingle =
      getTestFixtureContent("test_single.sasnb").toString();
    const flowDataSASNotebookSingle = getTestFixtureContent(
      "test_single_node.flw",
    ).toString();
    const [flowDataActual, flowDataExpected] = convertAndRemoveIds(
      contentSASNotebookSingle,
      "test.sasnb",
      flowDataSASNotebookSingle,
      workspace.getConfiguration().get("SAS.flowConversionMode"),
    );
    deepEqual(flowDataActual, flowDataExpected, "The flow data is not correct");
  });

  it("convert the multi cell sas notebook to swimlane flow", async () => {
    await updateWorkspaceSettings("Swimlane");
    const contentSASNotebookMulti =
      getTestFixtureContent("test_multi.sasnb").toString();
    const flowDataSASNotebookMulti = getTestFixtureContent(
      "test_multi_swimlane.flw",
    ).toString();
    const [flowDataActual, flowDataExpected] = convertAndRemoveIds(
      contentSASNotebookMulti,
      "test.sasnb",
      flowDataSASNotebookMulti,
      workspace.getConfiguration().get("SAS.flowConversionMode"),
    );
    deepEqual(flowDataActual, flowDataExpected, "The flow data is not correct");
  });

  it("convert the single cell sas notebook to swimlane flow", async () => {
    await updateWorkspaceSettings("Swimlane");
    const contentSASNotebookSingle =
      getTestFixtureContent("test_single.sasnb").toString();
    const flowDataSASNotebookSingle = getTestFixtureContent(
      "test_single_swimlane.flw",
    ).toString();
    const [flowDataActual, flowDataExpected] = convertAndRemoveIds(
      contentSASNotebookSingle,
      "test.sasnb",
      flowDataSASNotebookSingle,
      workspace.getConfiguration().get("SAS.flowConversionMode"),
    );
    deepEqual(flowDataActual, flowDataExpected, "The flow data is not correct");
  });

  it("convert the python notebook to node flow", async () => {
    await updateWorkspaceSettings("Node");
    const contentPythonNotebook =
      getTestFixtureContent("test.ipynb").toString();
    const flowDataPythonNotebook =
      getTestFixtureContent("test_ipynb.flw").toString();
    const [flowDataActual, flowDataExpected] = convertAndRemoveIds(
      contentPythonNotebook,
      "test.ipynb",
      flowDataPythonNotebook,
      workspace.getConfiguration().get("SAS.flowConversionMode"),
    );
    deepEqual(flowDataActual, flowDataExpected, "The flow data is not correct");
  });
});
