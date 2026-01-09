// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Connection } from "vscode-languageserver";
import { ProposedFeatures, createConnection } from "vscode-languageserver/node";

import { PyrightLanguageProviderNode } from "../python/node/PyrightLanguageProviderNode";
import { RLanguageProviderNode } from "../r/node/RLanguageProviderNode";
import { runServer } from "../server";

const connection: Connection = createConnection(ProposedFeatures.all);

runServer(
  connection,
  new PyrightLanguageProviderNode(connection, 1),
  new RLanguageProviderNode(connection),
);
