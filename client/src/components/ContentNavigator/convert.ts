const stepRef: Record<string, string> = {
  sas: "a7190700-f59c-4a94-afe2-214ce639fcde",
  sql: "a7190700-f59c-4a94-afe2-214ce639fcde",
  python: "ab59f8c4-af9a-4608-a5d5-a8365357bb99",
};

const stepTitle: Record<string, string> = {
  sas: "SAS Program",
  sql: "SQL Program",
  python: "Python Program",
};

interface Entry {
  language: string;
  code: string;
}

interface FlowData {
  creationTimeStamp: string;
  modifiedTimeStamp: string;
  createdBy: string;
  modifiedBy: string;
  version: number;
  id: null | string;
  name: string;
  description: null | string;
  properties: Record<string, string>;
  links: any[];
  nodes: Record<string, any>;
  parameters: Record<string, any>;
  connections: any[];
  extendedProperties: Record<string, any>;
  stickyNotes: any[];
}

function generateFlowData(inputList: Entry[], outputFile: string): FlowData {
  const now = new Date();
  const nowString = now.toISOString();
  const nowTimestamp = String(now.getTime());
  const flowData: FlowData = {
    creationTimeStamp: nowString,
    modifiedTimeStamp: nowString,
    createdBy: "user@sas.com",
    modifiedBy: "user@sas.com",
    version: 2,
    id: null,
    name: outputFile,
    description: null,
    properties: {
      UI_PROP_DF_OPTIMIZE: "false",
      UI_PROP_DF_ID: "120081fc-2d7f-4cfc-bcd3-47f9684e9763",
      UI_PROP_DF_EXECUTION_ORDERED: "false",
    },
    links: [],
    nodes: {},
    parameters: {},
    connections: [],
    extendedProperties: {},
    stickyNotes: [],
  };

  for (let idx = 0; idx < inputList.length; idx++) {
    const entry = inputList[idx];
    const nodeId = `id-${idx + 1}`;

    const stepNode = {
      nodeType: "step",
      version: 1,
      id: nodeId,
      name: stepTitle[entry.language],
      note: {
        version: 1,
        id: nodeId,
        name: null,
        description: null,
        properties: {
          UI_NOTE_PROP_HEIGHT: "0",
          UI_NOTE_PROP_IS_EXPANDED: "false",
          UI_NOTE_PROP_IS_STICKYNOTE: "false",
          UI_NOTE_PROP_WIDTH: "0",
        },
      },
      priority: idx,
      properties: {
        UI_PROP_COLORGRP: "0",
        UI_PROP_IS_INPUT_EXPANDED: "false",
        UI_PROP_IS_OUTPUT_EXPANDED: "false",
        UI_PROP_NODE_DATA_ID: stepRef[entry.language],
        UI_PROP_NODE_DATA_MODIFIED_DATE: nowTimestamp,
        UI_PROP_XPOS: String((idx + 1) * 150),
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
        path: `/dataFlows/steps/${stepRef[entry.language]}`,
      },
      arguments: {
        codeOptions: {
          code: entry.code,
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

    flowData.nodes[nodeId] = stepNode;

    if (idx > 0) {
      const connection = {
        sourcePort: {
          node: `id-${idx}`,
          portName: "outTables",
          index: 0,
        },
        targetPort: {
          node: nodeId,
          portName: "inTables",
          index: 0,
        },
      };
      flowData.connections.push(connection);
    }
  }
  return flowData;
}

export function convert_sasnb_to_flw(
  content: string,
  outputName: string,
): Uint8Array {
  const codeList = [];

  try {
    const notebookContent = JSON.parse(content);

    for (const cell of notebookContent) {
      let code = cell.value;
      if (code !== "") {
        const language = cell.language;
        if (language === "sql") {
          code = `
          PROC SQL;
              ${code}
              ;
          QUIT;
          RUN;
          `;
        }
        codeList.push({ code, language });
      }
    }
  } catch (error) {
    console.error("Error reading or parsing the .sasnb file:", error);
  }

  const flowData = generateFlowData(codeList, outputName);
  // encode json to utf8 bytes without new lines and spaces
  const flowDataString = JSON.stringify(flowData, null, 0);
  const flowDataUint8Array = new TextEncoder().encode(flowDataString);

  return flowDataUint8Array;
}
