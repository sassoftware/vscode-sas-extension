import { Profile, ProfileConfig } from '../src/viya/profile';
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


describe('Validate ProfileConfig operations', async function () {
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

    const testProfile = await profileConfig.getProfileByName('test');
    expect(testProfile['sas-endpoint']).to.equal('https://test-host.sas.com', 'Host is not matching');
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
    expect(activeProfile['profile']['sas-endpoint'], 'https://test-host.sas.com', 'Active profile endpoint not expected')

  });

  it('update a profile', async function () {
    const testProfile = await profileConfig.getProfileByName('test');
    testProfile['sas-endpoint'] = "https://test2-host.sas.com";
    profileConfig.upsertProfile("test", testProfile);

    // update a profile that already exists
    expect(testProfile['sas-endpoint']).to.equal('https://test2-host.sas.com');
    expect(testProfile['client-id']).to.equal('sas.test');

    // update a profile to a new token file
    testProfile['client-id'] = ''
    testProfile['token-file'] = '/home/test/.sas/token.txt'
    profileConfig.upsertProfile("test", testProfile);

    // validate te sanituze update the profile
    expect(testProfile).to.not.have.any.keys('client-id', 'client-secret');
    expect(testProfile['token-file']).to.equal('/home/test/.sas/token.txt');

    // update profile back to client-id
    testProfile['client-id'] = 'sas.test'
    profileConfig.upsertProfile("test", testProfile);

    // validate the sanitize updates the profile
    expect(testProfile).to.have.any.keys('client-id', 'client-secret');
    expect(testProfile).to.not.have.any.keys('token-file');
  });

  it('delete a profile', async function () {
    await profileConfig.deleteProfile('test');
    const profiles = await profileConfig.listProfile();
    expect(profiles).to.have.length(0);
  });

});

