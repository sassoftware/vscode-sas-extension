import { expect } from 'chai';
import * as userInput from '../../src/utils/userInput';

describe('Validate UserInput operations', function () {
  it('Verify host name is returning appropriate prompt', function () {
    const result = userInput.getProfilePrompt(userInput.ProfilePromptType.HostName);
    expect(result).to.not.equal(undefined);
    expect(result['title']).to.equal('Hostname for new profile (e.g. https://example.sas.com)', "Hostname title does not match expected");
  });
});
