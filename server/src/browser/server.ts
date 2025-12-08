// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Connection } from "vscode-languageserver";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from "vscode-languageserver/browser";

import { PyrightLanguageProviderBrowser } from "../python/browser/PyrightLanguageProviderBrowser";
import { RLanguageProviderBrowser } from "../r/browser/RLanguageProviderBrowser";
import { runServer } from "../server";

/* browser specific setup code */
const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection: Connection = createConnection(messageReader, messageWriter);

runServer(
  connection,
  new PyrightLanguageProviderBrowser(connection, 1),
  new RLanguageProviderBrowser(connection),
);
