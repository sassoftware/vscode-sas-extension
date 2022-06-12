import { Dictionary } from '../../src/utils/dictionary';
import { Profile } from '../../src/viya/profile';
import { expect } from 'chai';


let profileManager: Dictionary<Profile>;

before(async () => {
  profileManager = {};
})


describe('Validate Dictionary operations', function () {

  it('init dictionary', function () {
    expect(profileManager).to.deep.equal({});
  });

  it('Add element to dictionary', function () {
    profileManager["test"] = <Profile>{
      "client-id": "test.ec",
      "client-secret": "",
      "compute-context": "TEST SAS Compute",
      "sas-endpoint": "https://sas-endpoint"
    }

    expect(profileManager).to.have.keys('test');
    expect(profileManager['test']).to.deep.equal({
      "client-id": "test.ec",
      "client-secret": "",
      "compute-context": "TEST SAS Compute",
      "sas-endpoint": "https://sas-endpoint"
    });
  });

  it('update element from dictionary', function () {
    expect(profileManager).to.have.keys('test');
    profileManager['test']['compute-context'] = "TEST2 SAS Compute"
    expect(profileManager['test']).to.deep.equal({
      "client-id": "test.ec",
      "client-secret": "",
      "compute-context": "TEST2 SAS Compute",
      "sas-endpoint": "https://sas-endpoint"
    });
  });

  it('delete element from dictionary', function () {
    expect(profileManager).to.have.keys('test');
    delete profileManager['test'];
    expect(profileManager).to.not.have.keys('test');
  });

});
