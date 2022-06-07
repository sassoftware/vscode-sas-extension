import { Dictionary } from '../../src/utils/dictionary';
import { Profile, ProfileConfig } from '../../src/viya/profile';
import { existsSync, unlinkSync } from 'fs';
import { expect } from 'chai';
import path = require('path');
import sinon = require('sinon');

let testProfile: string;
let profileManager: ProfileConfig;

before(async () => {
  testProfile = path.resolve(path.join(__dirname, '..', '..', 'testFixture', 'testProfile.json'));
  profileManager = new ProfileConfig(testProfile, function () {
    return {};
  });
  // initializes profileManager
  await profileManager.get();
});

after(async () => {
  unlinkSync(testProfile);
});


describe('Validate ProfileConfig operations', async function () {
  it('validate initial profile', async function () {
    const profileLen = await profileManager.length();
    expect(profileLen).to.equal(0);
  });

  it('add a new profile', async function () {
    profileManager.upsertProfile("test", <Profile>{
      "sas-endpoint": "https://test-host.sas.com",
      "client-id": "sas.test",
      "client-secret": "",
      "compute-context": "SAS Studio context"
    });

    const profiles = await profileManager.listProfile();
    expect(profiles).to.have.length(1);
    expect(profiles).to.include('test');

    const testProfile = await profileManager.getProfile('test');
    expect(testProfile['sas-endpoint']).to.equal('https://test-host.sas.com');
  });

  it('update a profile', async function () {
    const testProfile = await profileManager.getProfile('test');
    testProfile['sas-endpoint'] = "https://test2-host.sas.com";
    profileManager.upsertProfile("test", testProfile);

    expect(testProfile['sas-endpoint']).to.equal('https://test2-host.sas.com');
  });

  it('delete a profile', async function () {
    await profileManager.deleteProfile('test');
    const profiles = await profileManager.listProfile();
    expect(profiles).to.have.length(0);
  });

});

describe('Validate ProfileBuilder', async function () {

  it('init profile builder', async function () {
    const mockProfileManager = sinon.mock(profileManager);


    mockProfileManager.expect()
  });
});