// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  DebugAdapterDescriptor,
  DebugAdapterInlineImplementation,
  DebugConfiguration,
  DebugConfigurationProvider,
  Disposable,
  ProviderResult,
  commands,
  debug,
  l10n,
  window,
  workspace,
} from "vscode";
import type { BaseLanguageClient } from "vscode-languageclient";

import {
  DEBUG_DOCUMENT_SCHEME,
  debugDocumentProvider,
} from "./DebugDocumentProvider";
import { SasDebugSession } from "./SasDebugSession";

export const SAS_DEBUG_TYPE = "sas";

const getDefaultConfiguration = (): DebugConfiguration => {
  const editor = window.activeTextEditor;
  return {
    type: SAS_DEBUG_TYPE,
    request: "launch",
    name: l10n.t("Debug SAS DATA Step"),
    program: editor?.document.uri.toString(),
    position: editor && {
      line: editor.selection.active.line,
      character: editor.selection.active.character,
    },
  };
};

class SasDebugConfigurationProvider implements DebugConfigurationProvider {
  /**
   * Fills in a default launch configuration when debugging is started
   * without a launch.json (e.g. F5 in a SAS file).
   */
  resolveDebugConfiguration(
    _folder: unknown,
    config: DebugConfiguration,
  ): ProviderResult<DebugConfiguration> {
    if (!config.type && !config.request && !config.name) {
      return getDefaultConfiguration();
    }
    return config;
  }
}

export function registerDebugger(client: BaseLanguageClient): Disposable[] {
  return [
    workspace.registerTextDocumentContentProvider(
      DEBUG_DOCUMENT_SCHEME,
      debugDocumentProvider,
    ),
    debug.registerDebugConfigurationProvider(
      SAS_DEBUG_TYPE,
      new SasDebugConfigurationProvider(),
    ),
    debug.registerDebugAdapterDescriptorFactory(SAS_DEBUG_TYPE, {
      createDebugAdapterDescriptor(): ProviderResult<DebugAdapterDescriptor> {
        return new DebugAdapterInlineImplementation(
          new SasDebugSession(client),
        );
      },
    }),
    commands.registerCommand("SAS.debugDataStep", () =>
      debug.startDebugging(undefined, getDefaultConfiguration()),
    ),
  ];
}
