import { Profile, ProfileConfig, getProfilePrompt, ProfilePromptType, AuthType } from '../src/viya/profile';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { expect } from 'chai';
import path = require('path');


let testProfile: string;
let testToken: string;
let profileConfig: ProfileConfig;
let testProfileClientId: Profile;
let testProfileTokenFile: Profile;
let testOverloadedProfile: Profile;
let testEmptyProfile: Profile;
let testEmptyItemsProfile: Profile;

before(async () => {
  testProfile = path.resolve(path.join(__dirname, '..', '..', 'testFixture', 'testProfile.json'));
  testToken = path.resolve(path.join(__dirname, '..', '..', 'testFixture', 'TestToken.txt'));
  testProfileClientId = <Profile>{
    "sas-endpoint": "https://test-host.sas.com",
    "client-id": "sas.test",
    "client-secret": "",
    "compute-context": "SAS Studio context"
  };
  testProfileTokenFile = <Profile>{
    "sas-endpoint": "https://test-host.sas.com",
    "token-file": testToken,
    "compute-context": "SAS Studio context"
  };
  testEmptyProfile = <Profile>{};
  testEmptyItemsProfile = <Profile>{
    "sas-endpoint": "",
    "token-file": "",
    "compute-context": "",
    "client-id": "",
    "client-secret": ""
  };
  testOverloadedProfile = <Profile>{
    "sas-endpoint": "https://test-host.sas.com",
    "token-file": testToken,
    "compute-context": "SAS Studio context",
    "client-id": "sas.test",
    "client-secret": ""
  };
  
  profileConfig = new ProfileConfig(testProfile, function () {
    return {};
  });
  // initializes profileConfig
  await profileConfig.get();
});

after(async () => {
  if (existsSync(testProfile)) {
    unlinkSync(testProfile);
  }
});


describe('profile', async function () {

  describe('config - crud', async function () {
    it('validate initial profile', async function () {
      // Setup
      // Execute
      const profileLen = await profileConfig.length();

      // Check
      expect(profileLen).to.equal(0, 'No profiles should exist');

      // Teardown
    });

    it('add a new profile', async function () {
      // Setup
      const profileName = 'test';
      await profileConfig.upsertProfile(profileName, testProfileClientId);

      // Execute
      const profiles = await profileConfig.listProfile();

      // Check
      expect(profiles).to.have.length(1, 'A single profile should be in the list');
      expect(profiles).to.include(profileName, 'Profile test should exist');

      // Teardown
      await profileConfig.deleteProfile(profileName);
    });

    it('get profile by name', async function () {
      // Setup
      const profileName = 'test';
      const profileToUse = testProfileClientId;
      await profileConfig.upsertProfile(profileName, profileToUse);
      
      // Execute
      const testProfile = await profileConfig.getProfileByName(profileName);

      // Check
      expect(testProfile['sas-endpoint']).to.equal('https://test-host.sas.com', 'Host is not matching');
      expect(testProfile['client-id']).to.equal('sas.test', 'Client ID not matching');
      expect(testProfile['client-secret']).to.equal('', 'Client Secret not matching');
      expect(testProfile['compute-context']).to.equal('SAS Studio context', 'Compute Context not matching');

      // Teardown
      await profileConfig.deleteProfile(profileName);
    });    

    it('update single element of a profile', async function () {
      // Setup
      const profileName = 'test';
      const profileToUse = testProfileClientId;
      await profileConfig.upsertProfile(profileName, profileToUse);
      const testProfile = await profileConfig.getProfileByName(profileName);

      // Execute
      // update profile manually
      testProfile['sas-endpoint'] = "https://test2-host.sas.com";
      await profileConfig.upsertProfile(profileName, testProfile);

      // Check
      // validate host has changed and client-id and token-file is still empty
      expect(testProfile['sas-endpoint']).to.equal('https://test2-host.sas.com');
      expect(testProfile['client-id']).to.equal('sas.test');
      expect(testProfile).to.not.have.any.keys('token-file');

      // Teardown
      await profileConfig.deleteProfile(profileName);
    });

    it('update profile from client-id to token', async function () {
      // Setup
      const profileName = 'test';
      const profileToUse = testProfileClientId;
      await profileConfig.upsertProfile(profileName, profileToUse);
      const testProfile = await profileConfig.getProfileByName(profileName);

      // Execute
      // update a profile to a new token file
      testProfile['client-id'] = '';
      testProfile['token-file'] = testToken;
      await profileConfig.upsertProfile(profileName, testProfile);

      // Check
      // validate that the client id and secret have been removed and the token-file exists
      expect(testProfile).to.not.have.any.keys('client-id', 'client-secret');
      expect(testProfile['token-file']).to.equal(testToken);

      // Teardown
      await profileConfig.deleteProfile(profileName);
    });

    it('update profile from token to client id/secret', async function () {
      // Setup
      const profileName = 'test';
      const profileToUse = testProfileTokenFile;
      await profileConfig.upsertProfile(profileName, profileToUse);
      const testProfile = await profileConfig.getProfileByName(profileName);

      // Execute
      // update profile back to client-id
      testProfile['client-id'] = 'sas.test';
      await profileConfig.upsertProfile(profileName, testProfile);

      // Check
      // validate that the token-file have been removed and the client id/secret exists
      expect(testProfile).to.have.any.keys('client-id', 'client-secret');
      expect(testProfile).to.not.have.any.keys('token-file');

      // Teardown
      await profileConfig.deleteProfile(profileName);
    });

    it('delete a profile', async function () {
      // Setup
      const profileName = 'test';
      const profileToUse = testProfileTokenFile;
      await profileConfig.upsertProfile(profileName, profileToUse);

      // Execute 
      await profileConfig.deleteProfile(profileName);

      // Check
      const profiles = await profileConfig.listProfile();
      expect(profiles).to.have.length(0);

      // Teardown
    });

    it('validate no active profile when empty', async function () {
      // Setup
      const profileName = 'test';
      const profileToUse = testEmptyProfile;
      await profileConfig.upsertProfile(profileName, profileToUse);
      const testProfile = await profileConfig.getProfileByName(profileName);

      // Execute
      const validateProfile = await profileConfig.validateProfile({name: profileName, profile: testProfile});

      // Check
      expect(validateProfile.data).to.equal(undefined);
      expect(validateProfile.type).to.equal(AuthType.Error, "validate no active profile did not return correct AuthType");
      expect(validateProfile.error).to.equal("No token or client found", "validate no active profile did not return error");

      // Teardown
      await profileConfig.deleteProfile(profileName);
    });

    it('validate no active profile when only name sent in', async function () {
      // Setup
      const profileName = 'test';
      const profileToUse = testEmptyProfile;
      await profileConfig.upsertProfile(profileName, profileToUse);

      // Execute
      const validateProfile = await profileConfig.validateProfile({name: profileName, profile: undefined});

      // Check
      expect(validateProfile.data).to.equal(undefined);
      expect(validateProfile.type).to.equal(AuthType.Error, "validate no active profile did not return correct AuthType");
      expect(validateProfile.error).to.equal("No Active Profile", "validate no active profile did not return error");

      // Teardown
      await profileConfig.deleteProfile(profileName);
    });

    it('list the expected profiles', async function () {
      // Setup
      const profileName = 'test';
      const profileToUse = testProfileTokenFile;
      await profileConfig.upsertProfile(profileName, profileToUse);

      // Execute
      const profileList = await profileConfig.listProfile();

      // Check
      expect(profileList).to.eql([profileName], 'Expected profile test does not exist ');

      // Teardown
      await profileConfig.deleteProfile(profileName);
    });

    it('get active profile when no profile active', async function () {
      // Setup
      // Do not set up profile

      // Execute
      const activeProfile = await profileConfig.getActiveProfile();

      // Check
      expect(activeProfile).to.be.equal(undefined, 'No active profile should be found');

      // Teardown
    });

    it('set active profile', async function () {
      // Setup
      const profileName = 'test';
      const profileToUse = testProfileTokenFile;
      await profileConfig.upsertProfile(profileName, profileToUse);

      // Execute
      await profileConfig.setActiveProfile(profileName);

      // Check
      const testProfile = await profileConfig.getProfileByName(profileName);
      expect(testProfile['active']).to.equal(true, 'Active profile not successfully set');

      // Teardown
      await profileConfig.deleteProfile(profileName);
    });

    it('get active profile', async function () {
      // Setup
      const profileName = 'test';
      const profileToUse = testProfileTokenFile;
      await profileConfig.upsertProfile(profileName, profileToUse);
      await profileConfig.setActiveProfile(profileName);

      // Execute
      const activeProfile = await profileConfig.getActiveProfile();

      // Check
      expect(activeProfile['name']).to.equal(profileName, 'Active profile has been set to test');
      expect(activeProfile['profile']['sas-endpoint'], 'https://test-host.sas.com', 'Active profile endpoint not expected');

      // Teardown
      await profileConfig.deleteProfile(profileName);
    });
    
  });

  it('validate client id/secret profile', async function () {
    // Setup
    const profileName = 'test';
    const profileToUse = testProfileClientId;
    await profileConfig.upsertProfile(profileName, profileToUse);
    const profileByName = await profileConfig.getProfileByName(profileName);

    // Execute
    const validateProfile = await profileConfig.validateProfile({name: profileName, profile: profileByName});

    // Check
    expect(validateProfile.data).to.equal(undefined);
    expect(validateProfile.type).to.equal(AuthType.Password, "validate client id/secret profile did not return correct AuthType");
    expect(validateProfile.error).to.equal('', "validate client id/secret profile should not return error");

    // Teardown
    await profileConfig.deleteProfile(profileName);
  });
  
  it('validate token file profile', async function () {
    // Setup
    const profileName = 'test';
    const profileToUse = testProfileTokenFile;
    await profileConfig.upsertProfile(profileName, profileToUse);
    const testProfile = await profileConfig.getProfileByName(profileName);

    // Execute
    const validateProfile = await profileConfig.validateProfile({name: profileName, profile: testProfile});

    // Check
    expect(validateProfile.data).to.equal(readFileSync(testToken, 'utf-8'));
    expect(validateProfile.type).to.equal(AuthType.TokenFile, "validate client token file profile did not return correct AuthType");
    expect(validateProfile.error).to.equal('', "validate token file profile should not return error");

    // Teardown
    await profileConfig.deleteProfile(profileName);
  });

  it('validate overloaded file profile', async function () {
    // Setup
    const profileName = 'test';
    const profileToUse = testOverloadedProfile;
    await profileConfig.upsertProfile(profileName, profileToUse);
    const testProfile = await profileConfig.getProfileByName(profileName);

    // Execute
    const validateProfile = await profileConfig.validateProfile({name: profileName, profile: testProfile});

    // Check
    // Overloaded file should take token as precedence
    expect(validateProfile.data).to.equal(undefined);
    expect(validateProfile.type).to.equal(AuthType.Password, "validate client overloaded file profile did not return correct AuthType");
    expect(validateProfile.error).to.equal('', "validate overloaded file profile should not return error");

    // Teardown
    await profileConfig.deleteProfile(profileName);
  });

  it('validate bad path for token file profile', async function () {
    // Setup
    const profileName = 'test';
    const profileToUse = testProfileTokenFile;
    profileToUse['token-file'] = '/fake/path/to/token.txt';
    await profileConfig.upsertProfile(profileName, profileToUse);
    const testProfile = await profileConfig.getProfileByName(profileName);

    // Execute
    const validateProfile = await profileConfig.validateProfile({name: profileName, profile: testProfile});

    // Check
    // Overloaded file should take token as precedence
    expect(validateProfile.data).to.equal(undefined);
    expect(validateProfile.type).to.equal(AuthType.Error, "validate bad token path profile did not return correct AuthType");
    expect(validateProfile.error).to.equal(`Please update profile (${profileName}): ENOENT: no such file or directory, open '${profileToUse['token-file']}'`, "validate overloaded file profile should return error");

    // Teardown
    await profileConfig.deleteProfile(profileName);
  });

  it('validate all empty items for profile', async function () {
    // Setup
    const profileName = 'test';
    const profileToUse = testEmptyItemsProfile;
    await profileConfig.upsertProfile(profileName, profileToUse);
    const testProfile = await profileConfig.getProfileByName(profileName);

    // Execute
    const validateProfile = await profileConfig.validateProfile({name: profileName, profile: testProfile});

    // Check
    // Overloaded file should take token as precedence
    expect(validateProfile.data).to.equal(undefined);
    expect(validateProfile.type).to.equal(AuthType.Error, "validate empty item profile did not return correct AuthType");
    expect(validateProfile.error).to.equal('No token or client found', "validate empty item should return error");

    // Teardown
    await profileConfig.deleteProfile(profileName);
  });

  describe('get input prompts', async function () {
    it('Valid Profile Input', function () {
      // Setup
      // Execute
      const result = getProfilePrompt(ProfilePromptType.Profile);

      // Check
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Select a profile', "Profile title does not match expected");
      expect(result['placeholder']).to.equal('Select Profile Name...', "Profile placeholder does not match expected");

      // Teardown
    });
  
    it('Valid New Profile Input', function () {
      // Setup
      // Execute
      const result = getProfilePrompt(ProfilePromptType.NewProfile);

      // Check
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Please enter new profile name', "NewProfile title does not match expected");
      expect(result['placeholder']).to.equal('Enter New Profile Name...', "NewProfile placeholder does not match expected");

      // Teardown
    });
  
    it('Valid Hostname Input', function () {
      // Setup
      // Execute
      const result = getProfilePrompt(ProfilePromptType.HostName);

      // Check
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Hostname for new profile (e.g. https://example.sas.com)', "Hostname title does not match expected");
      expect(result['placeholder']).to.equal('Enter hostname...', "Hostname placeholder does not match expected");

      // Teardown
    });
  
    it('Valid Profile Input', function () {
      // Setup
      // Execute
      const result = getProfilePrompt(ProfilePromptType.UpdateHostname);

      // Check
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Hostname for profile', "UpdateHostname title does not match expected");
      expect(result['placeholder']).to.equal('Enter hostname...', "UpdateHostname placeholder does not match expected");

      // Teardown
    });
  
    it('Valid Compute Context Input', function () {
      // Setup
      // Execute
      const result = getProfilePrompt(ProfilePromptType.ComputeContext);

      // Check
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Compute Context', "ComputeContext title does not match expected");
      expect(result['placeholder']).to.equal('Enter Compute Context...', "ComputeContext placeholder does not match expected");

      // Teardown
    });
 
    it('Valid Client Id Input', function () {
      // Setup
      // Execute
      const result = getProfilePrompt(ProfilePromptType.ClientId);

      // Check
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Client ID', "ClientId title does not match expected");
      expect(result['placeholder']).to.equal('Enter New Client ID...', "ClientId placeholder does not match expected");

      // Teardown
    });
  
    it('Valid Client Secret Input', function () {
      // Setup
      // Execute
      const result = getProfilePrompt(ProfilePromptType.ClientSecret);

      // Check
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Client Secret', "ClientSecret title does not match expected");
      expect(result['placeholder']).to.equal('Enter Client Secret...', "ClientSecret placeholder does not match expected");

      // Teardown
    });
  
    it('Valid Username Input', function () {
      // Setup
      // Execute
      const result = getProfilePrompt(ProfilePromptType.Username);

      // Check
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('SAS Username', "Username title does not match expected");
      expect(result['placeholder']).to.equal('Enter a SAS Username...', "Username placeholder does not match expected");

      // Teardown
    });
  
    it('Valid Password Input', function () {
      // Setup
      // Execute
      const result = getProfilePrompt(ProfilePromptType.Password);

      // Check
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('SAS Password', "Password title does not match expected");
      expect(result['placeholder']).to.equal('Enter a SAS Password...', "Password placeholder does not match expected");

      // Teardown
    });
  
    it('Valid Config File Input', function () {
      // Setup
      // Execute
      const result = getProfilePrompt(ProfilePromptType.ConfigFile);

      // Check
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('SAS Profile Config Path', "ConfigFile title does not match expected");
      expect(result['placeholder']).to.equal('Enter Config File Path...', "ConfigFile placeholder does not match expected");

      // Teardown
    });
  
    it('Valid Token File Input', function () {
      // Setup
      // Execute
      const result = getProfilePrompt(ProfilePromptType.TokenFile);

      // Check
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('SAS Token File Path', "TokenFile title does not match expected");
      expect(result['placeholder']).to.equal('Enter Token File Path...', "TokenFile placeholder does not match expected");

      // Teardown
    });
  });

});
