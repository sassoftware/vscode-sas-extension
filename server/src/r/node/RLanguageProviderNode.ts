// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CancellationToken,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  CompletionParams,
  Connection,
  Definition,
  DefinitionLink,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  Hover,
  HoverParams,
  InitializeParams,
  InitializeResult,
  MarkupContent,
  MarkupKind,
  Position,
  SignatureHelp,
  SignatureHelpParams,
  TextDocumentPositionParams,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { CodeZoneManager } from "../../sas/CodeZoneManager";
import { LanguageServiceProvider } from "../../sas/LanguageServiceProvider";
import { extractRCodes } from "../utils";

interface RFunctionInfo {
  label: string;
  detail: string;
  documentation: string;
  signature?: string;
}

/**
 * R Language Provider for Node environment.
 *
 * Provides basic R language features like code completion and hover info
 * using static function definitions. No R installation required.
 */
export class RLanguageProviderNode {
  protected sasLspProvider?: (uri: string) => LanguageServiceProvider;
  protected connection: Connection;
  protected rDocuments: Map<string, string> = new Map();

  // Common R functions with documentation
  private readonly rFunctions: Map<string, RFunctionInfo> = new Map([
    [
      "mean",
      {
        label: "mean",
        detail: "mean(x, trim = 0, na.rm = FALSE, ...)",
        documentation:
          "**Arithmetic Mean**\n\nCompute the arithmetic mean of a numeric vector.\n\n**Arguments:**\n- `x`: An R object\n- `trim`: Fraction of observations to be trimmed\n- `na.rm`: Logical. Should missing values be removed?",
        signature: "mean(x, trim = 0, na.rm = FALSE, ...)",
      },
    ],
    [
      "median",
      {
        label: "median",
        detail: "median(x, na.rm = FALSE, ...)",
        documentation:
          "**Median Value**\n\nCompute the sample median.\n\n**Arguments:**\n- `x`: An R object\n- `na.rm`: Logical. Should missing values be removed?",
        signature: "median(x, na.rm = FALSE, ...)",
      },
    ],
    [
      "sum",
      {
        label: "sum",
        detail: "sum(..., na.rm = FALSE)",
        documentation:
          "**Sum of Vector Elements**\n\nReturns the sum of all the values present in its arguments.\n\n**Arguments:**\n- `...`: Numeric or complex or logical vectors\n- `na.rm`: Logical. Should missing values be removed?",
        signature: "sum(..., na.rm = FALSE)",
      },
    ],
    [
      "length",
      {
        label: "length",
        detail: "length(x)",
        documentation:
          "**Length of an Object**\n\nGet or set the length of vectors (including lists) and factors.\n\n**Arguments:**\n- `x`: An R object",
        signature: "length(x)",
      },
    ],
    [
      "print",
      {
        label: "print",
        detail: "print(x, ...)",
        documentation:
          "**Print Values**\n\nPrints its argument and returns it invisibly.\n\n**Arguments:**\n- `x`: An R object\n- `...`: Further arguments passed to methods",
        signature: "print(x, ...)",
      },
    ],
    [
      "cat",
      {
        label: "cat",
        detail: "cat(..., sep = ' ')",
        documentation:
          "**Concatenate and Print**\n\nOutputs the objects, concatenating the representations.\n\n**Arguments:**\n- `...`: R objects\n- `sep`: Character string to separate arguments",
        signature: "cat(..., sep = ' ')",
      },
    ],
    [
      "c",
      {
        label: "c",
        detail: "c(...)",
        documentation:
          "**Combine Values into a Vector**\n\nCombine Values into a Vector or List.\n\n**Arguments:**\n- `...`: Objects to be concatenated",
        signature: "c(...)",
      },
    ],
    [
      "list",
      {
        label: "list",
        detail: "list(...)",
        documentation:
          "**Create a List**\n\nFunctions to construct, coerce and check for both kinds of R lists.\n\n**Arguments:**\n- `...`: Objects, possibly named",
        signature: "list(...)",
      },
    ],
    [
      "data.frame",
      {
        label: "data.frame",
        detail: "data.frame(..., row.names = NULL)",
        documentation:
          "**Create a Data Frame**\n\nCreates data frames, tightly coupled collections of variables.\n\n**Arguments:**\n- `...`: Column vectors\n- `row.names`: NULL or character vector",
        signature: "data.frame(..., row.names = NULL)",
      },
    ],
    [
      "matrix",
      {
        label: "matrix",
        detail: "matrix(data = NA, nrow = 1, ncol = 1)",
        documentation:
          "**Create a Matrix**\n\nCreates a matrix from the given set of values.\n\n**Arguments:**\n- `data`: Data vector\n- `nrow`: Number of rows\n- `ncol`: Number of columns",
        signature: "matrix(data = NA, nrow = 1, ncol = 1)",
      },
    ],
    [
      "plot",
      {
        label: "plot",
        detail: "plot(x, y, ...)",
        documentation:
          "**Generic X-Y Plotting**\n\nGeneric function for plotting of R objects.\n\n**Arguments:**\n- `x`: X coordinates\n- `y`: Y coordinates\n- `...`: Graphical parameters",
        signature: "plot(x, y, ...)",
      },
    ],
    [
      "head",
      {
        label: "head",
        detail: "head(x, n = 6L)",
        documentation:
          "**Return First Parts of an Object**\n\nReturns the first parts of a vector, matrix, table, data frame or function.\n\n**Arguments:**\n- `x`: An object\n- `n`: Integer. Number of elements to extract",
        signature: "head(x, n = 6L)",
      },
    ],
    [
      "tail",
      {
        label: "tail",
        detail: "tail(x, n = 6L)",
        documentation:
          "**Return Last Parts of an Object**\n\nReturns the last parts of a vector, matrix, table, data frame or function.\n\n**Arguments:**\n- `x`: An object\n- `n`: Integer. Number of elements to extract",
        signature: "tail(x, n = 6L)",
      },
    ],
    [
      "str",
      {
        label: "str",
        detail: "str(object, ...)",
        documentation:
          "**Display Structure of an Object**\n\nCompactly display the internal structure of an R object.\n\n**Arguments:**\n- `object`: Any R object\n- `...`: Additional arguments",
        signature: "str(object, ...)",
      },
    ],
    [
      "summary",
      {
        label: "summary",
        detail: "summary(object, ...)",
        documentation:
          "**Object Summary**\n\nGeneric function used to produce result summaries.\n\n**Arguments:**\n- `object`: An object\n- `...`: Additional arguments",
        signature: "summary(object, ...)",
      },
    ],
    [
      "lm",
      {
        label: "lm",
        detail: "lm(formula, data, ...)",
        documentation:
          "**Fit Linear Model**\n\nFit linear models. Used to fit linear regression.\n\n**Arguments:**\n- `formula`: Model formula\n- `data`: Data frame\n- `...`: Additional arguments",
        signature: "lm(formula, data, ...)",
      },
    ],
    [
      "glm",
      {
        label: "glm",
        detail: "glm(formula, family, data, ...)",
        documentation:
          "**Fit Generalized Linear Model**\n\nFit generalized linear models.\n\n**Arguments:**\n- `formula`: Model formula\n- `family`: Error distribution\n- `data`: Data frame",
        signature: "glm(formula, family, data, ...)",
      },
    ],
    [
      "read.csv",
      {
        label: "read.csv",
        detail: "read.csv(file, header = TRUE, ...)",
        documentation:
          "**Read CSV File**\n\nReads a file in table format and creates a data frame.\n\n**Arguments:**\n- `file`: File path\n- `header`: Logical. Does file have header?\n- `...`: Additional arguments",
        signature: "read.csv(file, header = TRUE, ...)",
      },
    ],
    [
      "write.csv",
      {
        label: "write.csv",
        detail: "write.csv(x, file, ...)",
        documentation:
          "**Write CSV File**\n\nWrites a data frame to a CSV file.\n\n**Arguments:**\n- `x`: Data frame to write\n- `file`: Output file path\n- `...`: Additional arguments",
        signature: "write.csv(x, file, ...)",
      },
    ],
    [
      "paste",
      {
        label: "paste",
        detail: "paste(..., sep = ' ', collapse = NULL)",
        documentation:
          "**Concatenate Strings**\n\nConcatenate vectors after converting to character.\n\n**Arguments:**\n- `...`: One or more R objects\n- `sep`: Character string to separate terms\n- `collapse`: Optional character string to separate results",
        signature: "paste(..., sep = ' ', collapse = NULL)",
      },
    ],
    [
      "for",
      {
        label: "for",
        detail: "for (var in seq) expr",
        documentation:
          "**For Loop**\n\nExecutes a loop over a sequence.\n\n**Arguments:**\n- `var`: Loop variable\n- `seq`: Sequence to iterate over\n- `expr`: Expression to execute",
        signature: "for (var in seq) expr",
      },
    ],
  ]);

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public setSasLspProvider(
    provider: (uri: string) => LanguageServiceProvider,
  ): void {
    this.sasLspProvider = provider;
  }

  public async initialize(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params: InitializeParams,
  ): Promise<InitializeResult> {
    return {
      capabilities: {
        hoverProvider: true,
        completionProvider: {
          triggerCharacters: [".", "$"],
        },
      },
    };
  }

  public onInitialized(): void {
    this.connection.console.log(
      "R language provider initialized (static mode)",
    );
  }

  public addContentChange(doc: TextDocument): void {
    if (!this.sasLspProvider) {
      return;
    }

    const lsp = this.sasLspProvider(doc.uri);
    const rCode = extractRCodes(doc, lsp);

    if (rCode) {
      this.rDocuments.set(doc.uri, rCode);
    } else {
      this.rDocuments.delete(doc.uri);
    }
  }

  public async onDidOpenTextDocument(
    params: DidOpenTextDocumentParams,
  ): Promise<void> {
    const doc = TextDocument.create(
      params.textDocument.uri,
      params.textDocument.languageId,
      params.textDocument.version,
      params.textDocument.text,
    );
    this.addContentChange(doc);
  }

  public async onDidCloseTextDocument(
    params: DidCloseTextDocumentParams,
  ): Promise<void> {
    this.rDocuments.delete(params.textDocument.uri);
  }

  public async onHover(
    params: HoverParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken,
  ): Promise<Hover | null> {
    const doc = this.getDocument(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    // Map SAS position to R code position
    const rPosition = this.mapSasPositionToR(
      params.textDocument.uri,
      params.position,
    );
    if (!rPosition) {
      return null;
    }

    // Get word at position in R code
    const word = this.getWordAtPosition(
      doc,
      rPosition.line,
      rPosition.character,
    );
    if (!word) {
      return null;
    }

    // Look up function info
    const funcInfo = this.rFunctions.get(word);
    if (funcInfo) {
      const contents: MarkupContent = {
        kind: MarkupKind.Markdown,
        value: `\`\`\`r\n${funcInfo.detail}\n\`\`\`\n\n${funcInfo.documentation}`,
      };
      return { contents };
    }

    return null;
  }

  public async onCompletion(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params: CompletionParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken,
  ): Promise<CompletionList | null> {
    const items: CompletionItem[] = Array.from(this.rFunctions.values()).map(
      (fn) => ({
        label: fn.label,
        kind: CompletionItemKind.Function,
        detail: fn.detail,
        documentation: fn.documentation,
      }),
    );

    return {
      isIncomplete: false,
      items,
    };
  }

  public async onCompletionResolve(
    item: CompletionItem,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken,
  ): Promise<CompletionItem> {
    return item;
  }

  public async onSignatureHelp(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params: SignatureHelpParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken,
  ): Promise<SignatureHelp | null> {
    return null;
  }

  public async onDefinition(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params: TextDocumentPositionParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | null> {
    return null;
  }

  public async onShutdown(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken,
  ): Promise<void> {
    this.rDocuments.clear();
  }

  private getDocument(uri: string): string | undefined {
    return this.rDocuments.get(uri);
  }

  private mapSasPositionToR(
    sasUri: string,
    sasPosition: Position,
  ): Position | null {
    if (!this.sasLspProvider) {
      return null;
    }

    const lsp = this.sasLspProvider(sasUri);
    const codeZoneManager = lsp.getCodeZoneManager();
    const zone = codeZoneManager.getCurrentZone(
      sasPosition.line,
      sasPosition.character,
    );

    // Only process if we're in an embedded language zone (R code)
    if (zone !== CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG) {
      return null;
    }

    // Find the line offset in the extracted R code
    const symbols = lsp.getDocumentSymbols();

    let rLineOffset = 0;
    for (const symbol of symbols) {
      if (symbol.name?.toUpperCase() !== "PROC RLANG") {
        continue;
      }

      // Find the start of the R code within this PROC RLANG
      let rCodeStartLine = symbol.range.start.line;
      const pos = { line: symbol.range.start.line, character: 0 };

      while (pos.line <= symbol.range.end.line) {
        const currentZone = codeZoneManager.getCurrentZone(
          pos.line,
          pos.character,
        );
        if (currentZone === CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG) {
          rCodeStartLine = pos.line;
          break;
        }
        pos.line++;
      }

      // If the cursor is in this PROC RLANG block
      if (
        sasPosition.line >= rCodeStartLine &&
        sasPosition.line <= symbol.range.end.line
      ) {
        const rLine = sasPosition.line - rCodeStartLine + rLineOffset;
        return {
          line: rLine,
          character: sasPosition.character,
        };
      }

      // Count lines in this R block for offset calculation
      let blockLines = 0;
      for (let line = rCodeStartLine; line <= symbol.range.end.line; line++) {
        if (
          codeZoneManager.getCurrentZone(line, 0) ===
          CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG
        ) {
          blockLines++;
        }
      }
      rLineOffset += blockLines;
    }

    return null;
  }

  private getWordAtPosition(
    doc: string,
    line: number,
    character: number,
  ): string | null {
    const lines = doc.split("\n");
    if (line >= lines.length) {
      return null;
    }

    const lineText = lines[line];
    if (character >= lineText.length) {
      return null;
    }

    // Find word boundaries
    let start = character;
    let end = character;

    // Move start back to beginning of word
    while (start > 0 && /[a-zA-Z0-9_.]/.test(lineText[start - 1])) {
      start--;
    }

    // Move end forward to end of word
    while (end < lineText.length && /[a-zA-Z0-9_.]/.test(lineText[end])) {
      end++;
    }

    const word = lineText.substring(start, end);
    return word.length > 0 ? word : null;
  }
}
