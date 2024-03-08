// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { env } from "vscode";

import { ChildProcessWithoutNullStreams, spawn } from "child_process";

import { scriptContent } from "./script";
import { Config, ITCProtocol } from "./types";

export function decodeEntities(msg: string) {
  // Some of our messages from the server contain html encoded
  // characters. This converts them back.
  const specialCharacters = {
    "&apos;": "'",
  };

  Object.entries(specialCharacters).map(([encodedHtml, text]) => {
    msg = msg.replace(encodedHtml, text);
  });

  return msg;
}

export const spawnPowershellProcess = (
  onWriteComplete: (error: Error) => void,
  onShellStdOut: (data: Buffer) => void,
  onShellStdErr: (data: Buffer) => void,
): ChildProcessWithoutNullStreams => {
  const shellProcess = spawn(
    "chcp 65001 >NUL & powershell.exe -NonInteractive -NoProfile -Command -",
    {
      shell: true,
      env: process.env,
    },
  );

  shellProcess.stdout.on("data", onShellStdOut);
  shellProcess.stderr.on("data", onShellStdErr);
  shellProcess.stdin.write(scriptContent + "\n", onWriteComplete);
  shellProcess.stdin.write(
    "$runner = New-Object -TypeName SASRunner\n",
    onWriteComplete,
  );

  return shellProcess;
};

/**
 * Formats the SAS Options provided in the profile into a format
 * that the shell process can understand.
 * @param sasOptions SAS Options array from the connection profile.
 * @returns a string  denoting powershell syntax for an array literal.
 */
const formatSASOptions = (sasOptions: string[]): string => {
  const optionsVariable = `@("${sasOptions.join(`","`)}")`;
  return optionsVariable;
};

export const runSetup = (
  shellProcess: ChildProcessWithoutNullStreams,
  config: Config,
  password: string,
  onWriteComplete: (error: Error) => void,
): void => {
  const { host, port, protocol, username } = config;
  shellProcess.stdin.write(`$profileHost = "${host}"\n`);
  shellProcess.stdin.write(`$port = ${port}\n`);
  shellProcess.stdin.write(`$protocol = ${protocol}\n`);
  shellProcess.stdin.write(`$username = "${username}"\n`);
  shellProcess.stdin.write(`$password = "${password}"\n`);
  shellProcess.stdin.write(
    `$serverName = "${
      protocol === ITCProtocol.COM ? "ITC Local" : "ITC IOM Bridge"
    }"\n`,
  );
  shellProcess.stdin.write(`$displayLang = "${env.language}"\n`);
  shellProcess.stdin.write(
    `$runner.Setup($profileHost,$username,$password,$port,$protocol,$serverName,$displayLang)\n`,
    onWriteComplete,
  );
  shellProcess.stdin.write("$runner.ResolveSystemVars()\n", onWriteComplete);

  if (config.sasOptions?.length > 0) {
    const sasOptsInput = `$sasOpts=${formatSASOptions(config.sasOptions)}\n`;
    shellProcess.stdin.write(sasOptsInput, onWriteComplete);
    shellProcess.stdin.write(`$runner.SetOptions($sasOpts)\n`, onWriteComplete);
  }
};

export const defaultSessionConfig = (protocol: ITCProtocol) => ({
  host: "localhost",
  port: 0,
  username: "",
  protocol,
});
