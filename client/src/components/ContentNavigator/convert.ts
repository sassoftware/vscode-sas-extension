// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, l10n, workspace } from "vscode";

import { basename } from "path";
import { v4 } from "uuid";

import RestContentAdapter from "../../connection/rest/RestContentAdapter";
import {
  associateFlowObject,
  createStudioSession,
} from "../../connection/studio";
import { ContentModel } from "./ContentModel";
import { MYFOLDER_TYPE, Messages } from "./const";
import { ContentItem } from "./types";
import { isContentItem } from "./utils";

const stepRef: Record<string, string> = {
  sas: "a7190700-f59c-4a94-afe2-214ce639fcde",
  sql: "a7190700-f59c-4a94-afe2-214ce639fcde",
  python: "ab59f8c4-af9a-4608-a5d5-a8365357bb99",
};

const stepTitle: Record<string, string> = {
  sas: l10n.t("SAS Program"),
  sql: l10n.t("SQL Program"),
  python: l10n.t("Python Program"),
};

const NODE_SPACING = 150;

interface Entry {
  language: string;
  code: string;
}

function getPropPort(idx: number, inputList: Entry[]): Record<string, string> {
  if (idx === 0) {
    return {
      "UI_PROP_PORT_DESCRIPTION|outTables|0": "Output tables",
      "UI_PROP_PORT_LABEL|outTables|0": "Output table 1",
    };
  }

  if (idx === inputList.length - 1) {
    return {
      "UI_PROP_PORT_DESCRIPTION|inTables|0": "Input tables",
      "UI_PROP_PORT_LABEL|inTables|0": "Input table 1",
    };
  }

  return {
    "UI_PROP_PORT_DESCRIPTION|inTables|0": "Input tables",
    "UI_PROP_PORT_LABEL|inTables|0": "Input table 1",
    "UI_PROP_PORT_DESCRIPTION|outTables|0": "Output tables",
    "UI_PROP_PORT_LABEL|outTables|0": "Output table 1",
  };
}

const baseFlow = {
  creationTimeStamp: "",
  modifiedTimeStamp: "",
  createdBy: "",
  modifiedBy: "",
  version: 2,
  id: null,
  name: "",
  description: null,
  properties: {
    UI_PROP_DF_OPTIMIZE: "false",
    UI_PROP_DF_ID: null,
    UI_PROP_DF_EXECUTION_ORDERED: "false",
  },
  links: [],
  nodes: {},
  parameters: {},
  connections: [],
  extendedProperties: {},
  stickyNotes: [],
};

const baseSwimlane = {
  dataFlowAndBindings: {
    dataFlow: {},
    executionBindings: {
      arguments: {
        __NO_OPTIMIZE: {
          argumentType: "string",
          value: "true",
          version: 1,
        },
      },
      contextId: null,
      environmentId: "compute",
      sessionId: null,
      tempTablePrefix: null,
    },
  },
  id: null,
  name: null,
  nodeType: "dataFlow",
  portMappings: [],
  priority: 0,
  properties: {
    UI_PROP_IS_EXPANDED: "true",
    UI_PROP_IS_SWIMLANE: "true",
  },
  version: 1,
};

const baseNode = {
  nodeType: "step",
  version: 1,
  id: null,
  name: null,
  note: {
    version: 1,
    id: null,
    name: null,
    description: null,
    properties: {
      UI_NOTE_PROP_HEIGHT: "0",
      UI_NOTE_PROP_IS_EXPANDED: "false",
      UI_NOTE_PROP_IS_STICKYNOTE: "false",
      UI_NOTE_PROP_WIDTH: "0",
    },
  },
  priority: 0,
  properties: {
    UI_PROP_COLORGRP: "0",
    UI_PROP_IS_INPUT_EXPANDED: "false",
    UI_PROP_IS_OUTPUT_EXPANDED: "false",
    UI_PROP_NODE_DATA_ID: null,
    UI_PROP_NODE_DATA_MODIFIED_DATE: null,
    UI_PROP_XPOS: "0",
    UI_PROP_YPOS: "75",
  },
  portMappings: [
    {
      mappingType: "tableStructure",
      portIndex: 0,
      portName: "outTables",
      tableStructure: {
        columnDefinitions: null,
      },
    },
  ],
  stepReference: {
    type: "uri",
    path: null,
  },
  arguments: {
    codeOptions: {
      code: null,
      contentType: "embedded",
      logHTML: "",
      resultsHTML: "",
      variables: [
        {
          name: "_input1",
          value: {
            portIndex: 0,
            portName: "inTables",
            referenceType: "inputPort",
          },
        },
        {
          name: "_output1",
          value: {
            arguments: {},
            portIndex: 0,
            portName: "outTables",
            referenceType: "outputPort",
          },
        },
      ],
    },
  },
};

function generateFlowDataNode(inputList: Entry[], outputFile: string) {
  const now = new Date();
  const nowString = now.toISOString();
  const nowTimestamp = String(now.getTime());
  const arrayIdNode: string[] = [];

  const flowData = { ...baseFlow };
  flowData.creationTimeStamp = nowString;
  flowData.modifiedTimeStamp = nowString;
  flowData.name = outputFile;
  flowData.properties = {
    ...baseFlow.properties,
    UI_PROP_DF_ID: "120081fc-2d7f-4cfc-bcd3-47f9684e9763",
  };
  flowData.nodes = {};
  flowData.connections = [];

  for (let idx = 0; idx < inputList.length; idx++) {
    const idNode = v4();
    const idNote = v4();
    const entry = inputList[idx];
    const propPorts = getPropPort(idx, inputList);

    const stepNode = {
      ...baseNode,
      id: idNode,
      name: stepTitle[entry.language],
      note: {
        ...baseNode.note,
        id: idNote,
      },
      priority: idx,
      properties: {
        ...baseNode.properties,
        ...propPorts,
        UI_PROP_NODE_DATA_ID: stepRef[entry.language],
        UI_PROP_NODE_DATA_MODIFIED_DATE: nowTimestamp,
        UI_PROP_XPOS: ((idx + 1) * NODE_SPACING).toString(),
      },
      stepReference: {
        ...baseNode.stepReference,
        path: `/dataFlows/steps/${stepRef[entry.language]}`,
      },
      arguments: {
        ...baseNode.arguments,
        codeOptions: {
          ...baseNode.arguments.codeOptions,
          code: entry.code,
        },
      },
    };

    flowData.nodes[idNode] = stepNode;
    arrayIdNode.push(idNode);

    if (idx > 0) {
      const connection = {
        sourcePort: {
          node: arrayIdNode[idx - 1],
          portName: "outTables",
          index: 0,
        },
        targetPort: {
          node: arrayIdNode[idx],
          portName: "inTables",
          index: 0,
        },
      };
      flowData.connections.push(connection);
    }
  }
  return flowData;
}

function generateFlowDataSwimlane(inputList: Entry[], outputFile: string) {
  const now = new Date();
  const nowString = now.toISOString();

  const flowData = { ...baseFlow };
  flowData.creationTimeStamp = nowString;
  flowData.modifiedTimeStamp = nowString;
  flowData.name = outputFile;
  flowData.properties = {
    ...baseFlow.properties,
    UI_PROP_DF_ID: "58e4d421-705d-448c-b397-cc8c9fab6c48",
    UI_PROP_DF_EXECUTION_ORDERED: "true",
  };
  flowData.nodes = {};
  flowData.connections = [];

  for (let idx = 0; idx < inputList.length; idx++) {
    const swimlaneName = "Notebook Cell " + (idx + 1).toString();
    const idNode = v4();
    const swimlane = {
      ...baseSwimlane,
      id: idNode,
      name: swimlaneName,
      priority: idx + 1,
      dataFlowAndBindings: {
        ...baseSwimlane.dataFlowAndBindings,
        dataFlow: generateFlowDataNode([inputList[idx]], null),
      },
    };
    flowData.nodes[idNode] = swimlane;
  }
  return flowData;
}

function generateFlowData(inputList: Entry[], outputFile: string) {
  const flowConversionMode = workspace
    .getConfiguration("SAS")
    .get("flowConversionMode");
  if (flowConversionMode === "Node") {
    return generateFlowDataNode(inputList, outputFile);
  }
  return generateFlowDataSwimlane(inputList, outputFile);
}

function generateCodeListFromSASNotebook(content: string): Entry[] {
  const codeList = [];
  try {
    const notebookContent = JSON.parse(content);
    for (const cell of notebookContent) {
      let code = cell.value;
      if (code !== "") {
        const language = cell.language;
        if (["python", "sas", "sql"].includes(language)) {
          if (language === "sql") {
            code = `PROC SQL;
${code};
QUIT;`;
          }
          codeList.push({ code, language });
        }
      }
    }
  } catch (error) {
    console.error("Error reading or parsing the .sasnb file:", error);
  }
  return codeList;
}

export function convertNotebookToFlow(
  content: string,
  inputName: string,
  outputName: string,
): string {
  let codeList = [];
  if (inputName.endsWith(".sasnb")) {
    codeList = generateCodeListFromSASNotebook(content);
  } else {
    console.error("Unsupported file type");
  }
  const flowData = generateFlowData(codeList, outputName);
  // encode json to utf8 bytes without new lines and spaces
  const flowDataString = JSON.stringify(flowData, null, 0);
  return flowDataString;
}

export class NotebookToFlowConverter {
  protected studioSessionId: string;
  public constructor(
    protected readonly resource: ContentItem | Uri,
    protected readonly contentModel: ContentModel,
    protected readonly viyaEndpoint: string,
  ) {}

  public get inputName() {
    return isContentItem(this.resource)
      ? this.resource.name
      : basename(this.resource.fsPath);
  }

  private get connection() {
    return (
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (this.contentModel.getAdapter() as RestContentAdapter).getConnection()
    );
  }

  private async parent() {
    const parentItem = isContentItem(this.resource)
      ? await this.contentModel.getParent(this.resource)
      : undefined;

    if (parentItem) {
      return parentItem;
    }

    const rootFolders = await this.contentModel.getChildren();
    const myFolder = rootFolders.find(
      (rootFolder) => rootFolder.type === MYFOLDER_TYPE,
    );
    if (!myFolder) {
      return undefined;
    }

    return myFolder;
  }

  public async content() {
    return isContentItem(this.resource)
      ? await this.contentModel.getContentByUri(this.resource.vscUri)
      : (await workspace.fs.readFile(this.resource)).toString();
  }

  public async establishConnection() {
    if (!this.contentModel.connected()) {
      this.contentModel.connect(this.viyaEndpoint);
    }

    try {
      const result = await createStudioSession(this.connection);
      this.studioSessionId = result;
    } catch (error) {
      this.studioSessionId = "";
    }

    return this.studioSessionId;
  }

  public async convert(outputName: string) {
    const flowDataString = convertNotebookToFlow(
      await this.content(),
      this.inputName,
      outputName,
    );
    const flowDataUint8Array = new TextEncoder().encode(flowDataString);
    if (flowDataUint8Array.length === 0) {
      throw new Error(Messages.NoCodeToConvert);
    }

    const parentItem = await this.parent();

    const newItem = await this.contentModel.createFile(
      parentItem,
      outputName,
      flowDataUint8Array,
    );
    if (!newItem) {
      throw new Error(
        l10n.t(Messages.NewFileCreationError, { name: this.inputName }),
      );
    }

    // associate the new .flw file with SAS Studio
    const folderName = await associateFlowObject(
      outputName,
      newItem.resourceId,
      parentItem.resourceId,
      this.studioSessionId,
      this.connection,
    );

    return { folderName, parentItem };
  }
}
