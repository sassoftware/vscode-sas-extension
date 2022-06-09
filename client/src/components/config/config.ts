import * as vscode from 'vscode';
import path from 'path';
import os from 'os';
import { createInputTextBox } from '../../utils/userInput';

const EXTENSION_CONFIG_KEY = "SAS.session";
const NEW_CONFIG_FILE_TITLE = 'SAS Profile Config Path';
const NEW_CONFIG_FILE_PLACEHOLDER = 'Enter Config File Location...';

const DEFAULT_CONFIG_FILE_PATH = path.join(os.homedir(), '.sas', 'vs-config.json');

export async function addPathToConfig(configKey: string, value: string): Promise<void> {
    await setConfigValue(configKey, value);
}

export async function setNewConfigValue(configKey: string, value: string): Promise<void> {
    await addValueToConfigAtScope(configKey, value, vscode.ConfigurationTarget.Global);
}

async function addValueToConfigAtScope(configKey: string, value: string, scope: vscode.ConfigurationTarget): Promise<void> {
    await vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY).update(configKey, value, scope);
}

export function getConfigFile(): string {
  let configPath = vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)['configFile'];
  if(!configPath){
    setNewConfigValue('configFile', DEFAULT_CONFIG_FILE_PATH);
    configPath = DEFAULT_CONFIG_FILE_PATH;
  }
  return configPath;
}

