// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  generateCodeListFromPythonNotebook,
  generateCodeListFromSASNotebook,
  generateFlowDataNode,
  generateFlowDataSwimlane,
} from "../../../src/components/ContentNavigator/convert";
import * as assert from "assert";

const contentSASNotebook1 = `[{"language": "python","value": "a, b = 4, 2\r\nprint('Result: ', a*10 + b)"},{"language": "sas","value": "data work.prdsale;\r\n\tset sashelp.PRDSALE;\r\nrun;\r\n\r\nproc means data=work.prdsale;\r\nrun;"},{"language": "markdown","value": "# test"},{"language": "sql","value": "CREATE TABLE WORK.QUERY_PRDSALE AS\r\n    SELECT\r\n        (t1.COUNTRY) LABEL='Country' FORMAT=$CHAR10.,\r\n        (SUM(t1.ACTUAL)) FORMAT=DOLLAR12.2 LENGTH=8 AS SUM_ACTUAL\r\n    FROM\r\n        WORK.PRDSALE t1\r\n    GROUP BY\r\n        t1.COUNTRY"}]`;

const contentSASNotebook2 = `[{"language": "sas","value": "data work.prdsale;\r\n\tset sashelp.PRDSALE;\r\nrun;\r\n\r\nproc means data=work.prdsale;\r\nrun;"}]`;

const contentPythonNotebook =
  '{"cells": [{"cell_type": "markdown","id": "26fe0d41-b4da-4902-845a-98e5c0c8e72a","metadata": {},"source": ["# Python test"]},{"cell_type": "code","execution_count": null,"id": "78855cba-1ec7-4e26-be74-23665ca2f4ee","metadata": {},"outputs": [],"source": ["import pandas as pd\n","\n","df = pd.DataFrame({\'col1\': [1, 2], \'col2\': [3, 4]})\n","df.head()"]},{"cell_type": "code","execution_count": null,"id": "7906e55d-829b-41da-8536-5dba90d2dddd","metadata": {},"outputs": [],"source": []},{"cell_type": "code","execution_count": null,"id": "483eda5c-6fb4-4193-99c1-7ea7ab9ad338","metadata": {},"outputs": [],"source": ["df.info()"]},{"cell_type": "code","execution_count": null,"id": "3f652f5e-c531-4e9d-9349-9ae1f52773ad","metadata": {},"outputs": [],"source": []}],"metadata": {"kernelspec": {"display_name": "Python 3 (ipykernel)","language": "python","name": "python3"},"language_info": {"codemirror_mode": {"name": "ipython","version": 3},"file_extension": ".py","mimetype": "text/x-python","name": "python","nbconvert_exporter": "python","pygments_lexer": "ipython3","version": "3.9.7"}},"nbformat": 4,"nbformat_minor": 5}';

const codeList1 = [
  {
    code: "a, b = 4, 2\r\nprint('Result: ', a*10 + b)",
    language: "python",
  },
  {
    code: "data work.prdsale;\r\n\tset sashelp.PRDSALE;\r\nrun;\r\n\r\nproc means data=work.prdsale;\r\nrun;",
    language: "sas",
  },
  {
    code: "PROC SQL;\nCREATE TABLE WORK.QUERY_PRDSALE AS\r\n    SELECT\r\n        (t1.COUNTRY) LABEL='Country' FORMAT=$CHAR10.,\r\n        (SUM(t1.ACTUAL)) FORMAT=DOLLAR12.2 LENGTH=8 AS SUM_ACTUAL\r\n    FROM\r\n        WORK.PRDSALE t1\r\n    GROUP BY\r\n        t1.COUNTRY;\nQUIT;",
    language: "sql",
  },
];

const codeList2 = [
  {
    code: "data work.prdsale;\r\n\tset sashelp.PRDSALE;\r\nrun;\r\n\r\nproc means data=work.prdsale;\r\nrun;",
    language: "sas",
  },
];

const codeList3 = [
  {
    code: "import pandas as pd\n\ndf = pd.DataFrame({'col1': [1, 2], 'col2': [3, 4]})\ndf.head()",
    language: "python",
  },
  {
    code: "df.info()",
    language: "python",
  },
];

const flowData1NodeString =
  '{"creationTimeStamp":"","modifiedTimeStamp":"","createdBy":"","modifiedBy":"","version":2,"id":null,"name":"test.flw","description":null,"properties":{"UI_PROP_DF_OPTIMIZE":"false","UI_PROP_DF_ID":"120081fc-2d7f-4cfc-bcd3-47f9684e9763","UI_PROP_DF_EXECUTION_ORDERED":"false"},"links":[],"nodes":{"6b1f66cb-adb9-4f70-a5a5-22a17c7b870b":{"nodeType":"step","version":1,"id":"6b1f66cb-adb9-4f70-a5a5-22a17c7b870b","name":"Python Program","note":{"version":1,"id":"a44165f8-ca2a-4b6b-833d-740153e99c6f","name":null,"description":null,"properties":{"UI_NOTE_PROP_HEIGHT":"0","UI_NOTE_PROP_IS_EXPANDED":"false","UI_NOTE_PROP_IS_STICKYNOTE":"false","UI_NOTE_PROP_WIDTH":"0"}},"priority":0,"properties":{"UI_PROP_COLORGRP":"0","UI_PROP_IS_INPUT_EXPANDED":"false","UI_PROP_IS_OUTPUT_EXPANDED":"false","UI_PROP_NODE_DATA_ID":"ab59f8c4-af9a-4608-a5d5-a8365357bb99","UI_PROP_NODE_DATA_MODIFIED_DATE":"","UI_PROP_XPOS":"150","UI_PROP_YPOS":"75","UI_PROP_PORT_DESCRIPTION|outTables|0":"Output tables","UI_PROP_PORT_LABEL|outTables|0":"Output table 1"},"portMappings":[{"mappingType":"tableStructure","portIndex":0,"portName":"outTables","tableStructure":{"columnDefinitions":null}}],"stepReference":{"type":"uri","path":"/dataFlows/steps/ab59f8c4-af9a-4608-a5d5-a8365357bb99"},"arguments":{"codeOptions":{"code":"a, b = 4, 2\r\nprint(\'Result: \', a*10 + b)","contentType":"embedded","logHTML":"","resultsHTML":"","variables":[{"name":"_input1","value":{"portIndex":0,"portName":"inTables","referenceType":"inputPort"}},{"name":"_output1","value":{"arguments":{},"portIndex":0,"portName":"outTables","referenceType":"outputPort"}}]}}},"fb992c70-0481-4afd-88a3-edcfa6c19b66":{"nodeType":"step","version":1,"id":"fb992c70-0481-4afd-88a3-edcfa6c19b66","name":"SAS Program","note":{"version":1,"id":"5d94739a-fad5-49d0-84bf-603dee64bc4a","name":null,"description":null,"properties":{"UI_NOTE_PROP_HEIGHT":"0","UI_NOTE_PROP_IS_EXPANDED":"false","UI_NOTE_PROP_IS_STICKYNOTE":"false","UI_NOTE_PROP_WIDTH":"0"}},"priority":1,"properties":{"UI_PROP_COLORGRP":"0","UI_PROP_IS_INPUT_EXPANDED":"false","UI_PROP_IS_OUTPUT_EXPANDED":"false","UI_PROP_NODE_DATA_ID":"a7190700-f59c-4a94-afe2-214ce639fcde","UI_PROP_NODE_DATA_MODIFIED_DATE":"","UI_PROP_XPOS":"300","UI_PROP_YPOS":"75","UI_PROP_PORT_DESCRIPTION|inTables|0":"Input tables","UI_PROP_PORT_LABEL|inTables|0":"Input table 1","UI_PROP_PORT_DESCRIPTION|outTables|0":"Output tables","UI_PROP_PORT_LABEL|outTables|0":"Output table 1"},"portMappings":[{"mappingType":"tableStructure","portIndex":0,"portName":"outTables","tableStructure":{"columnDefinitions":null}}],"stepReference":{"type":"uri","path":"/dataFlows/steps/a7190700-f59c-4a94-afe2-214ce639fcde"},"arguments":{"codeOptions":{"code":"data work.prdsale;\r\n\tset sashelp.PRDSALE;\r\nrun;\r\n\r\nproc means data=work.prdsale;\r\nrun;","contentType":"embedded","logHTML":"","resultsHTML":"","variables":[{"name":"_input1","value":{"portIndex":0,"portName":"inTables","referenceType":"inputPort"}},{"name":"_output1","value":{"arguments":{},"portIndex":0,"portName":"outTables","referenceType":"outputPort"}}]}}},"9f74c5b9-b123-4c2b-9e85-98ea98c844ef":{"nodeType":"step","version":1,"id":"9f74c5b9-b123-4c2b-9e85-98ea98c844ef","name":"SQL Program","note":{"version":1,"id":"15f38024-06d1-4568-8a3b-c08318b67242","name":null,"description":null,"properties":{"UI_NOTE_PROP_HEIGHT":"0","UI_NOTE_PROP_IS_EXPANDED":"false","UI_NOTE_PROP_IS_STICKYNOTE":"false","UI_NOTE_PROP_WIDTH":"0"}},"priority":2,"properties":{"UI_PROP_COLORGRP":"0","UI_PROP_IS_INPUT_EXPANDED":"false","UI_PROP_IS_OUTPUT_EXPANDED":"false","UI_PROP_NODE_DATA_ID":"a7190700-f59c-4a94-afe2-214ce639fcde","UI_PROP_NODE_DATA_MODIFIED_DATE":"","UI_PROP_XPOS":"450","UI_PROP_YPOS":"75","UI_PROP_PORT_DESCRIPTION|inTables|0":"Input tables","UI_PROP_PORT_LABEL|inTables|0":"Input table 1"},"portMappings":[{"mappingType":"tableStructure","portIndex":0,"portName":"outTables","tableStructure":{"columnDefinitions":null}}],"stepReference":{"type":"uri","path":"/dataFlows/steps/a7190700-f59c-4a94-afe2-214ce639fcde"},"arguments":{"codeOptions":{"code":"PROC SQL;\nCREATE TABLE WORK.QUERY_PRDSALE AS\r\n    SELECT\r\n        (t1.COUNTRY) LABEL=\'Country\' FORMAT=$CHAR10.,\r\n        (SUM(t1.ACTUAL)) FORMAT=DOLLAR12.2 LENGTH=8 AS SUM_ACTUAL\r\n    FROM\r\n        WORK.PRDSALE t1\r\n    GROUP BY\r\n        t1.COUNTRY;\nQUIT;","contentType":"embedded","logHTML":"","resultsHTML":"","variables":[{"name":"_input1","value":{"portIndex":0,"portName":"inTables","referenceType":"inputPort"}},{"name":"_output1","value":{"arguments":{},"portIndex":0,"portName":"outTables","referenceType":"outputPort"}}]}}}},"parameters":{},"connections":[{"sourcePort":{"node":"6b1f66cb-adb9-4f70-a5a5-22a17c7b870b","portName":"outTables","index":0},"targetPort":{"node":"fb992c70-0481-4afd-88a3-edcfa6c19b66","portName":"inTables","index":0}},{"sourcePort":{"node":"fb992c70-0481-4afd-88a3-edcfa6c19b66","portName":"outTables","index":0},"targetPort":{"node":"9f74c5b9-b123-4c2b-9e85-98ea98c844ef","portName":"inTables","index":0}}],"extendedProperties":{},"stickyNotes":[]}';
const flowData2NodeString =
  '{"creationTimeStamp":"","modifiedTimeStamp":"","createdBy":"","modifiedBy":"","version":2,"id":null,"name":"test.flw","description":null,"properties":{"UI_PROP_DF_OPTIMIZE":"false","UI_PROP_DF_ID":"120081fc-2d7f-4cfc-bcd3-47f9684e9763","UI_PROP_DF_EXECUTION_ORDERED":"false"},"links":[],"nodes":{"44b88526-45e7-476f-b41e-98d05cc4f156":{"nodeType":"step","version":1,"id":"44b88526-45e7-476f-b41e-98d05cc4f156","name":"SAS Program","note":{"version":1,"id":"e9131336-1b72-4348-a846-f1a1053770ee","name":null,"description":null,"properties":{"UI_NOTE_PROP_HEIGHT":"0","UI_NOTE_PROP_IS_EXPANDED":"false","UI_NOTE_PROP_IS_STICKYNOTE":"false","UI_NOTE_PROP_WIDTH":"0"}},"priority":0,"properties":{"UI_PROP_COLORGRP":"0","UI_PROP_IS_INPUT_EXPANDED":"false","UI_PROP_IS_OUTPUT_EXPANDED":"false","UI_PROP_NODE_DATA_ID":"a7190700-f59c-4a94-afe2-214ce639fcde","UI_PROP_NODE_DATA_MODIFIED_DATE":"","UI_PROP_XPOS":"150","UI_PROP_YPOS":"75","UI_PROP_PORT_DESCRIPTION|outTables|0":"Output tables","UI_PROP_PORT_LABEL|outTables|0":"Output table 1"},"portMappings":[{"mappingType":"tableStructure","portIndex":0,"portName":"outTables","tableStructure":{"columnDefinitions":null}}],"stepReference":{"type":"uri","path":"/dataFlows/steps/a7190700-f59c-4a94-afe2-214ce639fcde"},"arguments":{"codeOptions":{"code":"data work.prdsale;\r\n\tset sashelp.PRDSALE;\r\nrun;\r\n\r\nproc means data=work.prdsale;\r\nrun;","contentType":"embedded","logHTML":"","resultsHTML":"","variables":[{"name":"_input1","value":{"portIndex":0,"portName":"inTables","referenceType":"inputPort"}},{"name":"_output1","value":{"arguments":{},"portIndex":0,"portName":"outTables","referenceType":"outputPort"}}]}}}},"parameters":{},"connections":[],"extendedProperties":{},"stickyNotes":[]}';
const flowData1SwimlaneString =
  '{"creationTimeStamp":"","modifiedTimeStamp":"","createdBy":"","modifiedBy":"","version":2,"id":null,"name":"test.flw","description":null,"properties":{"UI_PROP_DF_OPTIMIZE":"false","UI_PROP_DF_ID":"58e4d421-705d-448c-b397-cc8c9fab6c48","UI_PROP_DF_EXECUTION_ORDERED":"true"},"links":[],"nodes":{"58fe57a2-ceff-4152-9fa1-5ff2e463bd12":{"dataFlowAndBindings":{"dataFlow":{"creationTimeStamp":"","modifiedTimeStamp":"","createdBy":"","modifiedBy":"","version":2,"id":null,"name":null,"description":null,"properties":{"UI_PROP_DF_OPTIMIZE":"false","UI_PROP_DF_ID":"120081fc-2d7f-4cfc-bcd3-47f9684e9763","UI_PROP_DF_EXECUTION_ORDERED":"false"},"links":[],"nodes":{"5815de58-3291-484f-9535-2cdfd5005599":{"nodeType":"step","version":1,"id":"5815de58-3291-484f-9535-2cdfd5005599","name":"Python Program","note":{"version":1,"id":"8562ac6e-4cae-4c9a-a441-32e1a828a5f0","name":null,"description":null,"properties":{"UI_NOTE_PROP_HEIGHT":"0","UI_NOTE_PROP_IS_EXPANDED":"false","UI_NOTE_PROP_IS_STICKYNOTE":"false","UI_NOTE_PROP_WIDTH":"0"}},"priority":0,"properties":{"UI_PROP_COLORGRP":"0","UI_PROP_IS_INPUT_EXPANDED":"false","UI_PROP_IS_OUTPUT_EXPANDED":"false","UI_PROP_NODE_DATA_ID":"ab59f8c4-af9a-4608-a5d5-a8365357bb99","UI_PROP_NODE_DATA_MODIFIED_DATE":"","UI_PROP_XPOS":"150","UI_PROP_YPOS":"75","UI_PROP_PORT_DESCRIPTION|outTables|0":"Output tables","UI_PROP_PORT_LABEL|outTables|0":"Output table 1"},"portMappings":[{"mappingType":"tableStructure","portIndex":0,"portName":"outTables","tableStructure":{"columnDefinitions":null}}],"stepReference":{"type":"uri","path":"/dataFlows/steps/ab59f8c4-af9a-4608-a5d5-a8365357bb99"},"arguments":{"codeOptions":{"code":"a, b = 4, 2\r\nprint(\'Result: \', a*10 + b)","contentType":"embedded","logHTML":"","resultsHTML":"","variables":[{"name":"_input1","value":{"portIndex":0,"portName":"inTables","referenceType":"inputPort"}},{"name":"_output1","value":{"arguments":{},"portIndex":0,"portName":"outTables","referenceType":"outputPort"}}]}}}},"parameters":{},"connections":[],"extendedProperties":{},"stickyNotes":[]},"executionBindings":{"arguments":{"__NO_OPTIMIZE":{"argumentType":"string","value":"true","version":1}},"contextId":null,"environmentId":"compute","sessionId":null,"tempTablePrefix":null}},"id":"58fe57a2-ceff-4152-9fa1-5ff2e463bd12","name":"Notebook Cell 1","nodeType":"dataFlow","portMappings":[],"priority":1,"properties":{"UI_PROP_IS_EXPANDED":"true","UI_PROP_IS_SWIMLANE":"true"},"version":1},"c3c46fc7-a7be-48c4-a45b-522255823332":{"dataFlowAndBindings":{"dataFlow":{"creationTimeStamp":"2023-08-28T15:20:29.500Z","modifiedTimeStamp":"2023-08-28T15:20:29.500Z","createdBy":"","modifiedBy":"","version":2,"id":null,"name":null,"description":null,"properties":{"UI_PROP_DF_OPTIMIZE":"false","UI_PROP_DF_ID":"120081fc-2d7f-4cfc-bcd3-47f9684e9763","UI_PROP_DF_EXECUTION_ORDERED":"false"},"links":[],"nodes":{"a0f74891-af4b-4a52-b082-13b2b61f4c49":{"nodeType":"step","version":1,"id":"a0f74891-af4b-4a52-b082-13b2b61f4c49","name":"SAS Program","note":{"version":1,"id":"2a951eff-ee42-4930-8aa6-2e21d5a4ee0d","name":null,"description":null,"properties":{"UI_NOTE_PROP_HEIGHT":"0","UI_NOTE_PROP_IS_EXPANDED":"false","UI_NOTE_PROP_IS_STICKYNOTE":"false","UI_NOTE_PROP_WIDTH":"0"}},"priority":0,"properties":{"UI_PROP_COLORGRP":"0","UI_PROP_IS_INPUT_EXPANDED":"false","UI_PROP_IS_OUTPUT_EXPANDED":"false","UI_PROP_NODE_DATA_ID":"a7190700-f59c-4a94-afe2-214ce639fcde","UI_PROP_NODE_DATA_MODIFIED_DATE":"","UI_PROP_XPOS":"150","UI_PROP_YPOS":"75","UI_PROP_PORT_DESCRIPTION|outTables|0":"Output tables","UI_PROP_PORT_LABEL|outTables|0":"Output table 1"},"portMappings":[{"mappingType":"tableStructure","portIndex":0,"portName":"outTables","tableStructure":{"columnDefinitions":null}}],"stepReference":{"type":"uri","path":"/dataFlows/steps/a7190700-f59c-4a94-afe2-214ce639fcde"},"arguments":{"codeOptions":{"code":"data work.prdsale;\r\n\tset sashelp.PRDSALE;\r\nrun;\r\n\r\nproc means data=work.prdsale;\r\nrun;","contentType":"embedded","logHTML":"","resultsHTML":"","variables":[{"name":"_input1","value":{"portIndex":0,"portName":"inTables","referenceType":"inputPort"}},{"name":"_output1","value":{"arguments":{},"portIndex":0,"portName":"outTables","referenceType":"outputPort"}}]}}}},"parameters":{},"connections":[],"extendedProperties":{},"stickyNotes":[]},"executionBindings":{"arguments":{"__NO_OPTIMIZE":{"argumentType":"string","value":"true","version":1}},"contextId":null,"environmentId":"compute","sessionId":null,"tempTablePrefix":null}},"id":"c3c46fc7-a7be-48c4-a45b-522255823332","name":"Notebook Cell 2","nodeType":"dataFlow","portMappings":[],"priority":2,"properties":{"UI_PROP_IS_EXPANDED":"true","UI_PROP_IS_SWIMLANE":"true"},"version":1},"787f1b4c-ee4c-4af0-ad8c-08b708acd34e":{"dataFlowAndBindings":{"dataFlow":{"creationTimeStamp":"2023-08-28T15:20:29.500Z","modifiedTimeStamp":"2023-08-28T15:20:29.500Z","createdBy":"","modifiedBy":"","version":2,"id":null,"name":null,"description":null,"properties":{"UI_PROP_DF_OPTIMIZE":"false","UI_PROP_DF_ID":"120081fc-2d7f-4cfc-bcd3-47f9684e9763","UI_PROP_DF_EXECUTION_ORDERED":"false"},"links":[],"nodes":{"f9792d84-cb90-47f5-acba-a3ac31bbefdf":{"nodeType":"step","version":1,"id":"f9792d84-cb90-47f5-acba-a3ac31bbefdf","name":"SQL Program","note":{"version":1,"id":"19e6d7b4-4f14-4509-bcdb-a0e88b9aba5c","name":null,"description":null,"properties":{"UI_NOTE_PROP_HEIGHT":"0","UI_NOTE_PROP_IS_EXPANDED":"false","UI_NOTE_PROP_IS_STICKYNOTE":"false","UI_NOTE_PROP_WIDTH":"0"}},"priority":0,"properties":{"UI_PROP_COLORGRP":"0","UI_PROP_IS_INPUT_EXPANDED":"false","UI_PROP_IS_OUTPUT_EXPANDED":"false","UI_PROP_NODE_DATA_ID":"a7190700-f59c-4a94-afe2-214ce639fcde","UI_PROP_NODE_DATA_MODIFIED_DATE":"","UI_PROP_XPOS":"150","UI_PROP_YPOS":"75","UI_PROP_PORT_DESCRIPTION|outTables|0":"Output tables","UI_PROP_PORT_LABEL|outTables|0":"Output table 1"},"portMappings":[{"mappingType":"tableStructure","portIndex":0,"portName":"outTables","tableStructure":{"columnDefinitions":null}}],"stepReference":{"type":"uri","path":"/dataFlows/steps/a7190700-f59c-4a94-afe2-214ce639fcde"},"arguments":{"codeOptions":{"code":"PROC SQL;\nCREATE TABLE WORK.QUERY_PRDSALE AS\r\n    SELECT\r\n        (t1.COUNTRY) LABEL=\'Country\' FORMAT=$CHAR10.,\r\n        (SUM(t1.ACTUAL)) FORMAT=DOLLAR12.2 LENGTH=8 AS SUM_ACTUAL\r\n    FROM\r\n        WORK.PRDSALE t1\r\n    GROUP BY\r\n        t1.COUNTRY;\nQUIT;","contentType":"embedded","logHTML":"","resultsHTML":"","variables":[{"name":"_input1","value":{"portIndex":0,"portName":"inTables","referenceType":"inputPort"}},{"name":"_output1","value":{"arguments":{},"portIndex":0,"portName":"outTables","referenceType":"outputPort"}}]}}}},"parameters":{},"connections":[],"extendedProperties":{},"stickyNotes":[]},"executionBindings":{"arguments":{"__NO_OPTIMIZE":{"argumentType":"string","value":"true","version":1}},"contextId":null,"environmentId":"compute","sessionId":null,"tempTablePrefix":null}},"id":"787f1b4c-ee4c-4af0-ad8c-08b708acd34e","name":"Notebook Cell 3","nodeType":"dataFlow","portMappings":[],"priority":3,"properties":{"UI_PROP_IS_EXPANDED":"true","UI_PROP_IS_SWIMLANE":"true"},"version":1}},"parameters":{},"connections":[],"extendedProperties":{},"stickyNotes":[]}';
const flowData2SwimlaneString =
  '{"creationTimeStamp":"","modifiedTimeStamp":"","createdBy":"","modifiedBy":"","version":2,"id":null,"name":"test.flw","description":null,"properties":{"UI_PROP_DF_OPTIMIZE":"false","UI_PROP_DF_ID":"58e4d421-705d-448c-b397-cc8c9fab6c48","UI_PROP_DF_EXECUTION_ORDERED":"true"},"links":[],"nodes":{"753d51ff-d9ff-4756-8fc3-f952b6811975":{"dataFlowAndBindings":{"dataFlow":{"creationTimeStamp":"","modifiedTimeStamp":"","createdBy":"","modifiedBy":"","version":2,"id":null,"name":null,"description":null,"properties":{"UI_PROP_DF_OPTIMIZE":"false","UI_PROP_DF_ID":"120081fc-2d7f-4cfc-bcd3-47f9684e9763","UI_PROP_DF_EXECUTION_ORDERED":"false"},"links":[],"nodes":{"f0c6f59e-6238-472e-a565-2c4902571e2c":{"nodeType":"step","version":1,"id":"f0c6f59e-6238-472e-a565-2c4902571e2c","name":"SAS Program","note":{"version":1,"id":"780d245a-2df6-49a1-a9cc-600f1c29eadd","name":null,"description":null,"properties":{"UI_NOTE_PROP_HEIGHT":"0","UI_NOTE_PROP_IS_EXPANDED":"false","UI_NOTE_PROP_IS_STICKYNOTE":"false","UI_NOTE_PROP_WIDTH":"0"}},"priority":0,"properties":{"UI_PROP_COLORGRP":"0","UI_PROP_IS_INPUT_EXPANDED":"false","UI_PROP_IS_OUTPUT_EXPANDED":"false","UI_PROP_NODE_DATA_ID":"a7190700-f59c-4a94-afe2-214ce639fcde","UI_PROP_NODE_DATA_MODIFIED_DATE":"","UI_PROP_XPOS":"150","UI_PROP_YPOS":"75","UI_PROP_PORT_DESCRIPTION|outTables|0":"Output tables","UI_PROP_PORT_LABEL|outTables|0":"Output table 1"},"portMappings":[{"mappingType":"tableStructure","portIndex":0,"portName":"outTables","tableStructure":{"columnDefinitions":null}}],"stepReference":{"type":"uri","path":"/dataFlows/steps/a7190700-f59c-4a94-afe2-214ce639fcde"},"arguments":{"codeOptions":{"code":"data work.prdsale;\r\n\tset sashelp.PRDSALE;\r\nrun;\r\n\r\nproc means data=work.prdsale;\r\nrun;","contentType":"embedded","logHTML":"","resultsHTML":"","variables":[{"name":"_input1","value":{"portIndex":0,"portName":"inTables","referenceType":"inputPort"}},{"name":"_output1","value":{"arguments":{},"portIndex":0,"portName":"outTables","referenceType":"outputPort"}}]}}}},"parameters":{},"connections":[],"extendedProperties":{},"stickyNotes":[]},"executionBindings":{"arguments":{"__NO_OPTIMIZE":{"argumentType":"string","value":"true","version":1}},"contextId":null,"environmentId":"compute","sessionId":null,"tempTablePrefix":null}},"id":"753d51ff-d9ff-4756-8fc3-f952b6811975","name":"Notebook Cell 1","nodeType":"dataFlow","portMappings":[],"priority":1,"properties":{"UI_PROP_IS_EXPANDED":"true","UI_PROP_IS_SWIMLANE":"true"},"version":1}},"parameters":{},"connections":[],"extendedProperties":{},"stickyNotes":[]}';

describe("convert notebook to code list", () => {
  it("convert the multi cell sas notebook to code list correctly", async () => {
    const codeList = generateCodeListFromSASNotebook(
      contentSASNotebook1
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/\r/g, "\\r"),
    );
    assert.equal(
      JSON.stringify(codeList),
      JSON.stringify(codeList1),
      "The code list is not correct",
    );
  });

  it("convert the one cell sas notebook to code list correctly", async () => {
    const codeList = generateCodeListFromSASNotebook(
      contentSASNotebook2
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/\r/g, "\\r"),
    );
    assert.equal(
      JSON.stringify(codeList),
      JSON.stringify(codeList2),
      "The code list is not correct",
    );
  });

  it("convert the python notebook to code list correctly", async () => {
    const codeList = generateCodeListFromPythonNotebook(
      contentPythonNotebook
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/\r/g, "\\r"),
    );
    assert.equal(
      JSON.stringify(codeList),
      JSON.stringify(codeList3),
      "The code list is not correct",
    );
  });
});

function removeIdsNodes(flowData) {
  flowData.creationTimeStamp = "";
  flowData.modifiedTimeStamp = "";
  flowData.createdBy = "";
  flowData.modifiedBy = "";
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
  }
  return flowData;
}

function removeIdsSwimlanes(flowData) {
  flowData.creationTimeStamp = "";
  flowData.modifiedTimeStamp = "";
  flowData.createdBy = "";
  flowData.modifiedBy = "";
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

describe("convert code list to flow", () => {
  it("convert multi code list to swimlane flow correctly", async () => {
    let flowData = generateFlowDataSwimlane(codeList1, "test.flw");
    flowData = removeIdsSwimlanes(flowData);
    flowData.name = "test.flw";
    const flowDataString = JSON.stringify(flowData);
    let flowData1Swimlane = JSON.parse(
      flowData1SwimlaneString
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/\r/g, "\\r"),
    );
    flowData1Swimlane = removeIdsSwimlanes(flowData1Swimlane);
    const flowData1SwimlaneStringConvert = JSON.stringify(flowData1Swimlane);
    assert.equal(
      flowDataString,
      flowData1SwimlaneStringConvert,
      "The flow data is not correct",
    );
  });

  it("convert single code list to swimlane flow correctly", async () => {
    let flowData = generateFlowDataSwimlane(codeList2, "test.flw");
    flowData = removeIdsSwimlanes(flowData);
    flowData.name = "test.flw";
    const flowDataString = JSON.stringify(flowData);
    let flowData2Swimlane = JSON.parse(
      flowData2SwimlaneString
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/\r/g, "\\r"),
    );
    flowData2Swimlane = removeIdsSwimlanes(flowData2Swimlane);
    const flowData2SwimlaneStringConvert = JSON.stringify(flowData2Swimlane);
    assert.equal(
      flowDataString,
      flowData2SwimlaneStringConvert,
      "The flow data is not correct",
    );
  });

  it("convert multi code list to node flow correctly", async () => {
    let flowData = generateFlowDataNode(codeList1, "test.flw");
    flowData.name = "test.flw";
    flowData = removeIdsNodes(flowData);
    const flowDataString = JSON.stringify(flowData);
    let flowData1Node = JSON.parse(
      flowData1NodeString
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/\r/g, "\\r"),
    );
    flowData1Node = removeIdsNodes(flowData1Node);
    const flowData1NodeStringConvert = JSON.stringify(flowData1Node);
    assert.equal(
      flowDataString,
      flowData1NodeStringConvert,
      "The flow data is not correct",
    );
  });

  it("convert the single code list to node flow correctly", async () => {
    let flowData = generateFlowDataNode(codeList2, "test.flw");
    flowData.name = "test.flw";
    flowData = removeIdsNodes(flowData);
    const flowDataString = JSON.stringify(flowData);
    // escape new lines and tabulations before parse
    let flowData2Node = JSON.parse(
      flowData2NodeString
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/\r/g, "\\r"),
    );
    flowData2Node = removeIdsNodes(flowData2Node);
    const flowData2NodeStringConvert = JSON.stringify(flowData2Node);
    assert.equal(
      flowDataString,
      flowData2NodeStringConvert,
      "The flow data is not correct",
    );
  });
});
