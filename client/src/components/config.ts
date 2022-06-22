import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';
import path from 'path';
import os from 'os';

const EXTENSION_CONFIG_KEY = "SAS.session";
const DEFAULT_CONFIG_FILE_PATH = path.join(os.homedir(), '.sas', 'vs-config.json');


/**
 * Add a vscode setting to a gloabl configuration target by key/value.
 * 
 * @param configKey {@link String} the setting key
 * @param value {@link String} the value for the key
 */
export async function addValueToGlobalConfig(configKey: string, value: string): Promise<void> {
  await addValueToConfigAtScope(configKey, value, vscode.ConfigurationTarget.Global);
}

/**
 * Add a vscode setting to a specific vscode configuration target by key/value.
 * 
 * @param configKey {@link String} the setting key
 * @param value {@link String} the value for the key
 * @param scope {@link ConfigurationTarget} scope of the vscode setting
 */
async function addValueToConfigAtScope(configKey: string, value: string, scope: vscode.ConfigurationTarget): Promise<void> {
  await vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY).update(configKey, value, scope);
}

/**
 * Get a configuration file from the vscode settings.
 * 
 * @returns String path to the configuration file
 */
export function getConfigFile(): string {
  let configPath = vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)['configFile'];
  if (!configPath) {
    addValueToGlobalConfig('configFile', DEFAULT_CONFIG_FILE_PATH);
    configPath = DEFAULT_CONFIG_FILE_PATH;
  }
  return configPath;
}
