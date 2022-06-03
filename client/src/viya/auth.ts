// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { readFileSync, readFile, writeFileSync, existsSync, mkdirSync } from "fs";
import { ConfigurationTarget, QuickPickItem, window, workspace } from "vscode";
import os from 'os';
import path from 'path';

export const PROFILE_TITLE = 'Enter a New Profile Name, or choose from current profile list!';

export const NEW_PROFILE_TITLE = 'Please enter new Profile Name';
export const NEW_PROFILE_PLACEHOLDER = 'Enter New Profile Name...';

export const NEW_HOSTNAME_TITLE = 'Hostname for new profile (e.g. https://daily.plover-m1.unx.sas.com)';
export const NEW_HOSTNAME_PLACEHOLDER = 'Enter hostname...';

export const UPDATE_HOSTNAME_TITLE = 'Hostname for profile';
export const UPDATE_HOSTNAME_PLACEHOLDER = 'Enter hostname...';

export const COMPUTE_CONTEXT_TITLE = 'Compute Context';
export const COMPUTE_CONTEXT_PLACEHOLDER = 'Enter Compute Context...';

export const CLIENT_ID_TITLE = 'Client ID';
export const CLIENT_ID_PLACEHOLDER = 'Enter Client ID...';

export const CLIENT_SECRET_TITLE = 'Client Secret';
export const CLIENT_SECRET_PLACEHOLDER = 'Enter Client Secret...';

export const USERNAME_TITLE = 'SAS Username';
export const USERNAME_PLACEHOLDER = 'Enter a SAS Username...';

export const NEW_CONFIG_FILE_TITLE = 'SAS Profile Config Path';
export const NEW_CONFIG_FILE_PLACEHOLDER = 'Enter Config File Location...';

export type AuthConfig =
  | {
      authType: "server";
      host: string;
      token: string;
      tokenType: "bearer";
    }
  | {
      authType: "password";
      host: string;
      clientID: string;
      clientSecret: string;
      user: string;
      password: string;
      computeContext: string;
    };

export async function getAuthConfig(): Promise<AuthConfig> {
  // flag for New Profile
  let newProfile = false;
  const profileList: QuickPickItem[] = [];

  const config = workspace.getConfiguration("SAS.session");

  //Get configuration file from settings
  let configFile: string = config.get("configFile");
  //If nothing is stored, assume first time use
  if(configFile === ''){
    configFile = await createInputTextBox(NEW_CONFIG_FILE_PLACEHOLDER, NEW_CONFIG_FILE_TITLE, path.join(os.homedir(), '.sas', 'vs-config.json'));
    //Persist config file location
    config.update("configFile", configFile, ConfigurationTarget.Global).then(() => {
      window.showInformationMessage(`SAS Config file set to ${configFile}`);
    });
  }
  //If file doesn't exist
  if(!existsSync(configFile)){
    //Create path and file if it doesn't exist
    mkdirSync(path.dirname(configFile), { recursive: true });
    writeFileSync(configFile, '', 'utf8');
    newProfile = true;
    window.showInformationMessage(`Created config file: ${configFile}`);
  }


  // Read Config Data
  const configFileData = readFileSync(configFile, 'utf8');

  let configData = {};
  if(!(configFileData.length === 0)){
    configData = JSON.parse(configFileData);
  }

  // Search if the the configuration is valid
  if(Object.keys(configData).length){
    for (const [key, obj] of Object.entries(configData)) {
      profileList.push({
        label: key,
        description: obj['sas-endpoint'],
        detail: `Client ID: ${obj['client-id']}`
      })
    }
  }
  // If new profile, prompt user to create new profile, else, load profiles to view
  const selectedProfile = newProfile ? await createInputTextBox(NEW_PROFILE_PLACEHOLDER, NEW_PROFILE_TITLE) : await createQuickPickInput(profileList, PROFILE_TITLE);
  let host = '';
  let clientID = '';
  let clientSecret = '';
  let computeContext = '';
  // If profile doesn't exist, add it
  if(!Object.keys(configData).includes(selectedProfile)){
    host = await createInputTextBox(NEW_HOSTNAME_PLACEHOLDER, NEW_HOSTNAME_TITLE);
    clientID = await createInputTextBox(CLIENT_ID_PLACEHOLDER, CLIENT_ID_TITLE);
    if(clientID === ''){
      clientID = ''
    }
    clientSecret = await createInputTextBox(CLIENT_SECRET_PLACEHOLDER, CLIENT_SECRET_TITLE);
    if(!clientSecret){
      clientSecret = '';
    }
    computeContext = await createInputTextBox(COMPUTE_CONTEXT_PLACEHOLDER, COMPUTE_CONTEXT_TITLE, 'SAS Job Execution compute context');
    if(!computeContext){
      computeContext = '';
    }
    const newProfile = {
      [selectedProfile]: {
        "sas-endpoint": host,
        "client-id": clientID,
        "client-secret": clientSecret,
        "compute-context": computeContext
      }
    }
    Object.assign(configData, newProfile);
    window.showInformationMessage(`Adding ${selectedProfile} to ${configFile}`);
    writeFileSync(configFile, JSON.stringify(configData, null, 2));
  } else {
    // If profile exists, but no options, update the options
    if(configData[selectedProfile]['sas-endpoint'] === undefined){
      configData[selectedProfile]['sas-endpoint'] = await createInputTextBox(UPDATE_HOSTNAME_PLACEHOLDER, UPDATE_HOSTNAME_TITLE);
      writeFileSync(configFile, JSON.stringify(configData, null, 2));
    }
    if(configData[selectedProfile]['client-id'] === undefined){
      configData[selectedProfile]['client-id'] = await createInputTextBox(CLIENT_ID_PLACEHOLDER, CLIENT_ID_TITLE);
      writeFileSync(configFile, JSON.stringify(configData, null, 2));
    }
    if(configData[selectedProfile]['client-secret'] === undefined){ 
      configData[selectedProfile]['client-secret'] = await createInputTextBox(CLIENT_SECRET_PLACEHOLDER, CLIENT_SECRET_TITLE);
      writeFileSync(configFile, JSON.stringify(configData, null, 2));
    }
    if(configData[selectedProfile]['compute-context'] === undefined){ 
      configData[selectedProfile]['compute-context'] = await createInputTextBox(COMPUTE_CONTEXT_PLACEHOLDER, COMPUTE_CONTEXT_TITLE, 'SAS Job Execution compute context');
      writeFileSync(configFile, JSON.stringify(configData, null, 2));
    }
    host = configData[selectedProfile]['sas-endpoint'];
    clientID = configData[selectedProfile]['client-id'];
    clientSecret = configData[selectedProfile]['client-secret'];
    computeContext = configData[selectedProfile]['compute-context'];
  }

  
  const user: string = await createInputTextBox(USERNAME_PLACEHOLDER, USERNAME_TITLE, config.get("user"));
 
  return new Promise((resolve, reject) => {
    if (host === "") {
      reject("SAS server hostname could not be found.");
      return;
    }

    const tokenFile: string = config.get("tokenFile");
    if (tokenFile.length > 0) {
      readFile(tokenFile, (err, data) => {
        if (err && err.message) {
          reject(err.message);
          return;
        }
        resolve({
          authType: "server",
          host,
          token: data.toString(),
          tokenType: "bearer",
        });
      });
      return;
    }

    // no token file found. Go with password flow
    if (user === "" || clientID === "") {
      reject(
        "Either token file, or user and client ID/Secret needed for authentication."
      );
      return;
    }
    window
      .showInputBox({
        title: `Password for ${user}`,
        placeHolder: 'Enter a password...',
        password: true,
      })
      .then((password) => {
        if (password)
          resolve({
            authType: "password",
            host,
            clientID,
            clientSecret,
            user,
            password,
            computeContext
          });
        else reject("No password");
      });
  });
}

async function createQuickPickInput(options, title) {
  return new Promise<string>((resolve) => {
    const quickPick = window.createQuickPick();

    const DEFAULT_ITEMS = options.map(option => ({ label: option.label, description: option.description, detail: option.detail }));
    quickPick.items = DEFAULT_ITEMS;

    quickPick.title = title;

    quickPick.onDidChangeValue(() => {
        if (!quickPick.value){
          quickPick.items = DEFAULT_ITEMS;
        } 
        else if (!options.includes(quickPick.value)){
          quickPick.items = [{label: quickPick.value}, ...options].map(option => ({ label: option.label, description: option.description ? option.description : "Create New", detail: option.detail }));
        } 
    })

    quickPick.onDidAccept(() => {
        const selection = quickPick.activeItems[0];
        resolve(selection.label)
        quickPick.hide()
    })
    quickPick.show();
  })
}

async function createInputTextBox(placeHolder, title, defaultValue=null) {
  return window.showInputBox({
    title,
    ignoreFocusOut: true,
    placeHolder: placeHolder,
    value: defaultValue
  });
}
