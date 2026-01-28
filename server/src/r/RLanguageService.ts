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
 * Service for querying R help documentation and inspecting R objects.
 * Uses R's help() system for functions and parses source code for variables.
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
      // Try to get help for built-in functions using tools::Rd2txt
      const rCommand = `tryCatch({
        if(exists('${symbol}') && is.function(get('${symbol}'))) {
          hfile <- help('${symbol}');
          if(length(hfile) > 0) {
            txt <- capture.output(tools::Rd2txt(utils:::.getHelpFile(hfile)));
            cat('HELP:', paste(txt, collapse='\\n'));
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
   * Clean up R help text formatting characters
   * Removes backspace-based formatting (underscore+backspace for underlining, char+backspace for bold)
   */
  private cleanRHelpFormatting(text: string): string {
    return (
      text
        // eslint-disable-next-line no-control-regex
        .replace(/_\x08/g, "") // Remove underscore+backspace (used for underlining)
        // eslint-disable-next-line no-control-regex
        .replace(/(.)\x08/g, "$1") // Remove char+backspace (used for bold)
        .replace(/_(.)/g, "$1") // Remove remaining underscores
    );
  }

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
    const cleaned = this.cleanRHelpFormatting(help.description);

    return `\`\`\`r\n${cleaned}\n\`\`\``;
  }
  /**
   * Get signature help for a function (parameters and their types)
   */
  async getSignatureHelp(
    functionName: string,
  ): Promise<{ label: string; parameters: string[]; documentation?: string }> {
    try {
      const rCommand = `tryCatch({
        if(exists('${functionName}') && is.function(get('${functionName}'))) {
          # Get function arguments
          args_list <- formals('${functionName}');
          if(length(args_list) > 0) {
            # Just get parameter names, not default values
            params <- names(args_list);
            cat('PARAMS:', paste(params, collapse=', '));
          } else {
            cat('PARAMS:');
          }
        }
      }, error = function(e) cat('ERROR:', e$message))`;

      const { stdout } = await execAsync(
        `${this.rPath} --vanilla --slave -e "${rCommand}"`,
        { timeout: 2000 },
      );

      const output = stdout.trim();
      if (output.startsWith("PARAMS:")) {
        const paramsStr = output.substring(7).trim();
        const parameters = paramsStr
          ? paramsStr.split(",").map((p) => p.trim())
          : [];
        const label = `${functionName}(${paramsStr})`;

        // Try to get brief documentation with proper formatting
        const helpResult = await this.getHelp(functionName);
        let documentation: string | undefined;
        if (helpResult?.description) {
          // Clean up formatting characters
          const cleaned = this.cleanRHelpFormatting(helpResult.description);

          // Get just the first section (title + brief description)
          const lines = cleaned.split("\n");
          const firstSectionEnd = lines.findIndex(
            (line, idx) =>
              idx > 0 && line.trim() === "" && lines[idx + 1]?.trim() !== "",
          );
          documentation =
            firstSectionEnd > 0
              ? lines.slice(0, firstSectionEnd).join("\n").trim()
              : lines.slice(0, 5).join("\n").trim();
        }

        return { label, parameters, documentation };
      }

      return { label: `${functionName}()`, parameters: [] };
    } catch {
      return { label: `${functionName}()`, parameters: [] };
    }
  }

  /**
   * Get completion suggestions for R code
   */
  async getCompletions(
    prefix: string,
    sourceCode?: string,
  ): Promise<Array<{ label: string; kind: string; detail?: string }>> {
    const completions: Array<{ label: string; kind: string; detail?: string }> =
      [];

    try {
      // Get matching functions from base R and loaded packages
      const rCommand = `tryCatch({
        # Get all matching objects
        matches <- apropos('^${prefix}', ignore.case=FALSE);
        for(m in matches) {
          if(exists(m)) {
            obj <- get(m);
            if(is.function(obj)) {
              cat('FUNC:', m, '\\n');
            } else {
              cat('VAR:', m, '\\n');
            }
          }
        }
      }, error = function(e) {})`;

      const { stdout } = await execAsync(
        `${this.rPath} --vanilla --slave -e "${rCommand}"`,
        { timeout: 2000 },
      );

      const lines = stdout.trim().split("\n");
      for (const line of lines) {
        if (line.startsWith("FUNC:")) {
          const name = line.substring(5).trim();
          completions.push({ label: name, kind: "Function" });
        } else if (line.startsWith("VAR:")) {
          const name = line.substring(4).trim();
          completions.push({ label: name, kind: "Variable" });
        }
      }

      // Also add local variables from source code if provided
      if (sourceCode) {
        const varPattern = /\b([a-zA-Z][a-zA-Z0-9._]*)\s*(<-|=)/g;
        let match;
        const localVars = new Set<string>();

        while ((match = varPattern.exec(sourceCode)) !== null) {
          const varName = match[1];
          if (varName.startsWith(prefix)) {
            localVars.add(varName);
          }
        }

        for (const varName of localVars) {
          if (!completions.some((c) => c.label === varName)) {
            completions.push({
              label: varName,
              kind: "Variable",
              detail: "local variable",
            });
          }
        }
      }

      return completions;
    } catch {
      return [];
    }
  }

  /**
   * Clear the help cache
   */
  clearCache(): void {
    this.helpCache.clear();
  }
}
