// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface RHelpResult {
  name: string;
  title?: string;
  description?: string;
  usage?: string;
  arguments?: string;
  details?: string;
  value?: string;
  examples?: string;
  package?: string;
}

/**
 * Service for querying R help documentation using an R runtime.
 * This allows us to get documentation for any R function, including tidyverse packages.
 */
export class RHelpService {
  private rPath: string;
  private helpCache: Map<string, RHelpResult | null> = new Map();

  constructor(rPath: string = "R") {
    this.rPath = rPath;
  }

  /**
   * Get information for an R symbol
   * For functions: shows help documentation
   * For variables: parses source code to find definition
   */
  async getHelp(
    symbol: string,
    sourceCode?: string,
  ): Promise<RHelpResult | null> {
    // Check cache first
    const cacheKey = `${symbol}:${sourceCode ? "local" : "global"}`;
    if (this.helpCache.has(cacheKey)) {
      return this.helpCache.get(cacheKey)!;
    }

    try {
      // First, try to get help for built-in functions using tools::Rd2txt
      const rCommand = `tryCatch({
        if(exists('${symbol}')) {
          obj <- get('${symbol}');
          if(is.function(obj)) {
            hfile <- help('${symbol}');
            if(length(hfile) > 0) {
              txt <- capture.output(tools::Rd2txt(utils:::.getHelpFile(hfile)));
              cat('HELP:', paste(txt, collapse='\\n'));
            }
          } else {
            cat('VALUE:', paste(deparse(obj), collapse=' '));
          }
        }
      }, error = function(e) cat(''))`;

      const { stdout } = await execAsync(
        `${this.rPath} --vanilla --slave -e "${rCommand}"`,
        { timeout: 2000, maxBuffer: 1024 * 1024 },
      );

      const output = stdout.trim();

      // Parse the output to determine type
      let result: RHelpResult | null = null;

      if (output.startsWith("HELP:")) {
        result = {
          name: symbol,
          description: output.substring(5).trim(),
          package: "help",
        };
      } else if (output.startsWith("VALUE:")) {
        result = {
          name: symbol,
          description: output.substring(6).trim(),
          package: "variable",
        };
      } else if (sourceCode) {
        // Try to find the variable definition in the source code
        const varDef = this.findVariableDefinition(symbol, sourceCode);
        if (varDef) {
          result = {
            name: symbol,
            description: varDef,
            package: "variable",
          };
        }
      }

      this.helpCache.set(cacheKey, result);
      return result;
    } catch {
      // If R is not available or evaluation fails, cache null
      this.helpCache.set(symbol, null);
      return null;
    }
  }

  /**
   * Check if R runtime is available
   */
  async isRAvailable(): Promise<boolean> {
    try {
      await execAsync(`${this.rPath} --version`, { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find variable definition in source code
   * Looks for patterns like: varname <- value
   */
  private findVariableDefinition(
    symbol: string,
    sourceCode: string,
  ): string | null {
    // Look for assignment patterns: symbol <- value or symbol = value
    const assignmentRegex = new RegExp(
      `${symbol}\\s*(<-|=)\\s*([^\\n;]+)`,
      "g",
    );
    const match = assignmentRegex.exec(sourceCode);
    if (match) {
      return match[2].trim();
    }
    return null;
  }

  /**
  /**
   * Format R output as Markdown
   */
  formatAsMarkdown(help: RHelpResult): string {
    if (!help.description) {
      return `**${help.name}**\n\nNo information available.`;
    }

    // For variables, show as simple R code
    if (help.package === "variable") {
      return `\`\`\`r\n${help.name} <- ${help.description}\n\`\`\``;
    }

    // For help documentation, clean up formatting characters
    let cleaned = help.description
      .replace(/_\x08/g, "") // Remove underscore+backspace (used for underlining)
      .replace(/(.)\x08/g, "$1") // Remove char+backspace (used for bold)
      .replace(/_(.)/g, "$1"); // Remove remaining underscores

    return `\`\`\`r\n${cleaned}\n\`\`\``;
  }
  /**
   * Clear the help cache
   */
  clearCache(): void {
    this.helpCache.clear();
  }
}
