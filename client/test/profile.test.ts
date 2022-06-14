import { Profile, ProfileConfig, getProfilePrompt, ProfilePromptType } from '../src/viya/profile';
import { existsSync, unlinkSync } from 'fs';
import { expect } from 'chai';
import path = require('path');


let testProfile: string;
let profileConfig: ProfileConfig;

before(async () => {
  testProfile = path.resolve(path.join(__dirname, '..', '..', 'testFixture', 'testProfile.json'));
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
      const profileLen = await profileConfig.length();
      expect(profileLen).to.equal(0, 'No profiles should exist');
    });

    it('add a new profile', async function () {
      profileConfig.upsertProfile("test", <Profile>{
        "sas-endpoint": "https://test-host.sas.com",
        "client-id": "sas.test",
        "client-secret": "",
        "compute-context": "SAS Studio context"
      });

      const profiles = await profileConfig.listProfile();
      expect(profiles).to.have.length(1, 'A single profile should be in the list');
      expect(profiles).to.include('test', 'Profile test should exist');
    });

    it('delete a profile', async function () {
      await profileConfig.deleteProfile('test');
      const profiles = await profileConfig.listProfile();
      expect(profiles).to.have.length(0);
    });

    it('get profile by name', async function () {
      profileConfig.upsertProfile("test", <Profile>{
        "sas-endpoint": "https://test-host.sas.com",
        "client-id": "sas.test",
        "client-secret": "",
        "compute-context": "SAS Studio context"
      });
      const testProfile = await profileConfig.getProfileByName('test');
      expect(testProfile['sas-endpoint']).to.equal('https://test-host.sas.com', 'Host is not matching');
      expect(testProfile['client-id']).to.equal('sas.test', 'Client ID not matching');
      expect(testProfile['client-secret']).to.equal('', 'Client Secret not matching');
      expect(testProfile['compute-context']).to.equal('SAS Studio context', 'Compute Context not matching');
    });    

    it('list the expected profiles', async function () {
      const profileList = await profileConfig.listProfile();
      expect(profileList).to.eql(['test'], 'Expected profile test does not exist ')
    });

    it('get active profile when no profile active', async function () {
      const activeProfile = await profileConfig.getActiveProfile();
      expect(activeProfile).to.be.equal(undefined, 'No active profile should be found');
    });

    it('set active profile', async function () {
      await profileConfig.setActiveProfile("test");
      const activeProfile = await profileConfig.getActiveProfile();
      expect(activeProfile['name']).to.equal('test', 'Active profile has been set to test');
      expect(activeProfile['profile']['sas-endpoint'], 'https://test-host.sas.com', 'Active profile endpoint not expected');
    });

    it('update a profile', async function () {
      const testProfile = await profileConfig.getProfileByName('test');

      // update a profile that already exists
      testProfile['sas-endpoint'] = "https://test2-host.sas.com";
      profileConfig.upsertProfile("test", testProfile);

      // validate host has changed and client-id and token-file has not changed
      expect(testProfile['sas-endpoint']).to.equal('https://test2-host.sas.com');
      expect(testProfile['client-id']).to.equal('sas.test');
      expect(testProfile).to.not.have.any.keys('token-file');

      // update a profile to a new token file
      testProfile['client-id'] = ''
      testProfile['token-file'] = '/home/test/.sas/token.txt'
      profileConfig.upsertProfile("test", testProfile);

      // validate the sanitize updates the profile
      expect(testProfile).to.not.have.any.keys('client-id', 'client-secret');
      expect(testProfile['token-file']).to.equal('/home/test/.sas/token.txt');

      // update profile back to client-id
      testProfile['client-id'] = 'sas.test'
      profileConfig.upsertProfile("test", testProfile);

      // validate the sanitize updates the profile
      expect(testProfile).to.have.any.keys('client-id', 'client-secret');
      expect(testProfile).to.not.have.any.keys('token-file');
    });
  });


  describe('get profile input prompt', async function () {
    it('Valid Profile Input', function () {
      const result = getProfilePrompt(ProfilePromptType.Profile);
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Select a profile', "Profile title does not match expected");
      expect(result['placeholder']).to.equal('Select Profile Name...', "Profile placeholder does not match expected");
    });
  });

  describe('get new profile input prompt', async function () {
    it('Valid New Profile Input', function () {
      const result = getProfilePrompt(ProfilePromptType.NewProfile);
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Please enter new profile name', "NewProfile title does not match expected");
      expect(result['placeholder']).to.equal('Enter New Profile Name...', "NewProfile placeholder does not match expected");
    });
  });

  describe('get hostname input prompt', async function () {
    it('Valid Hostname Input', function () {
      const result = getProfilePrompt(ProfilePromptType.HostName);
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Hostname for new profile (e.g. https://example.sas.com)', "Hostname title does not match expected");
      expect(result['placeholder']).to.equal('Enter hostname...', "Hostname placeholder does not match expected");
    });
  });

  describe('get profile input prompt', async function () {
    it('Valid Profile Input', function () {
      const result = getProfilePrompt(ProfilePromptType.UpdateHostname);
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Hostname for profile', "UpdateHostname title does not match expected");
      expect(result['placeholder']).to.equal('Enter hostname...', "UpdateHostname placeholder does not match expected");
    });
  });

  describe('get compute context input prompt', async function () {
    it('Valid Compute Context Input', function () {
      const result = getProfilePrompt(ProfilePromptType.ComputeContext);
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Compute Context', "ComputeContext title does not match expected");
      expect(result['placeholder']).to.equal('Enter Compute Context...', "ComputeContext placeholder does not match expected");
    });
  });

  describe('get client id input prompt', async function () {
    it('Valid Client Id Input', function () {
      const result = getProfilePrompt(ProfilePromptType.ClientId);
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Client ID', "ClientId title does not match expected");
      expect(result['placeholder']).to.equal('Enter New Client ID...', "ClientId placeholder does not match expected");
    });
  });

  describe('get client secret input prompt', async function () {
    it('Valid Client Secret Input', function () {
      const result = getProfilePrompt(ProfilePromptType.ClientSecret);
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('Client Secret', "ClientSecret title does not match expected");
      expect(result['placeholder']).to.equal('Enter Client Secret...', "ClientSecret placeholder does not match expected");
    });
  });

  describe('get username input prompt', async function () {
    it('Valid Username Input', function () {
      const result = getProfilePrompt(ProfilePromptType.Username);
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('SAS Username', "Username title does not match expected");
      expect(result['placeholder']).to.equal('Enter a SAS Username...', "Username placeholder does not match expected");
    });
  });

  describe('get password input prompt', async function () {
    it('Valid Password Input', function () {
      const result = getProfilePrompt(ProfilePromptType.Password);
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('SAS Password', "Password title does not match expected");
      expect(result['placeholder']).to.equal('Enter a SAS Password...', "Password placeholder does not match expected");
    });
  });

  describe('get config file input prompt', async function () {
    it('Valid Config File Input', function () {
      const result = getProfilePrompt(ProfilePromptType.ConfigFile);
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('SAS Profile Config Path', "ConfigFile title does not match expected");
      expect(result['placeholder']).to.equal('Enter Config File Path...', "ConfigFile placeholder does not match expected");
    });
  });

  describe('get token file input prompt', async function () {
    it('Valid Token File Input', function () {
      const result = getProfilePrompt(ProfilePromptType.TokenFile);
      expect(result).to.not.equal(undefined);
      expect(result['title']).to.equal('SAS Token File Path', "TokenFile title does not match expected");
      expect(result['placeholder']).to.equal('Enter Token File Path...', "TokenFile placeholder does not match expected");
    });
  });
});
