import {
  Profile,
  ProfileConfig,
  getProfilePrompt,
  ProfilePromptType,
  AuthType,
  EXTENSION_CONFIG_KEY,
  EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
} from "../src/viya/profile";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { expect } from "chai";
import path = require("path");
import { ConfigurationTarget, workspace } from "vscode";

let testProfileName: string;
let testProfileNewName: string;
let testProfile: string;
let testToken: string;
let profileConfig: ProfileConfig;
let testProfileClientId;
let testProfileTokenFile;
let testOverloadedProfile;
let testEmptyProfile;
let testEmptyItemsProfile;

async function initProfile(): Promise<void> {
  profileConfig = new ProfileConfig();
}

describe("Profiles", async function () {
  before(async () => {
    await workspace
      .getConfiguration(EXTENSION_CONFIG_KEY)
      .update(
        EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
        undefined,
        ConfigurationTarget.Global
      );
    testToken = path.resolve(
      path.join(__dirname, "..", "..", "testFixture", "TestToken.txt")
    );
    testProfileClientId = {
      "activeProfile": "",
      "profiles": {
        "testProfile": {
          "endpoint": "https://test-host.sas.com",
          "clientId": "sas.test",
          "clientSecret": "",
          "context": "SAS Studio context",
          "username": "sastest"
        }
      }
    };
    testProfileTokenFile = {
      "activeProfile": "",
      "profiles": {
        "testProfile": {
          "endpoint": "https://test-host.sas.com",
          "context": "SAS Studio context",
          "token": "path/to/token.txt"
        }
      }
    };
    testEmptyProfile = {
      "activeProfile": "",
      "profiles": {
        "testProfile": {}
      }
    };
    testEmptyItemsProfile = {
      "activeProfile": "",
      "profiles": {
        "testProfile": {
          "endpoint": "",
          "token": "",
          "context": "",
          "username": "",
          "clientId": "",
          "clientSecret": ""
        }
      }
    };
    testOverloadedProfile = {
      "activeProfile": "",
      "profiles": {
        "testProfile": {
          "endpoint": "https://test-host.sas.com",
          "clientId": "sas.test",
          "clientSecret": "",
          "context": "SAS Studio context",
          "username": "sastest",
          "token": "path/to/token.txt"
        }
      }
    };
  });

  afterEach(async () => {
    if (testProfileName) {
      testProfileName = "";
    }
    if (testProfileNewName) {
      testProfileNewName = "";
    }
  });

  describe("No Profile", async function () {
    beforeEach(async () => {
      testProfileNewName = "testProfile";
      initProfile();
    });
    describe("CRUD Operations", async function () {
      it("validate initial state", async function () {
        // Arrange
        // Act
        const profileLen = await profileConfig.length();

        // Verify
        expect(profileLen).to.equal(0, "No profiles should exist");
      });

      it("add a new profile", async function () {
        // Arrange
        // Act
        await profileConfig.upsertProfile(testProfileNewName, <Profile>{
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
        });
        const profiles = await profileConfig.listProfile();

        // Assert
        expect(profiles).to.have.length(
          1,
          "A single profile should be in the list"
        );
        expect(profiles).to.include(
          testProfileNewName,
          `Profile ${testProfileName} should exist`
        );
      });
    });
  });

  describe("ClientId/Secret Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      testProfileNewName = "testProfile2";
      await initProfile();
      await workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testProfileClientId,
          ConfigurationTarget.Global
        );
    });
    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        // Arrange
        // Act
        await profileConfig.upsertProfile(testProfileNewName, <Profile>{
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
        });
        const profiles = await profileConfig.listProfile();

        // Assert
        expect(profiles).to.have.length(
          2,
          "A second profile should be in the list"
        );
        expect(profiles).to.include(
          testProfileNewName,
          `Profile ${testProfileNewName} should exist`
        );
      });

      it("delete a profile", async function () {
        // Arrange
        // Act
        await profileConfig.deleteProfile(testProfileName);

        // Assert
        const profiles = await profileConfig.listProfile();
        expect(profiles).to.have.length(0);
      });

      it("list the expected profiles", async function () {
        // Arrange
        // Act
        const profileList = profileConfig.listProfile();

        // Assert
        expect(profileList).to.eql(
          [testProfileName],
          "Expected profile name does not exist"
        );
      });

      it("get profile by name", async function () {
        // Arrange
        // Act
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );

        // Assert
        expect(testProfile["endpoint"]).to.equal(
          "https://test-host.sas.com",
          "Host is not matching"
        );
        expect(testProfile["clientId"]).to.equal(
          "sas.test",
          "Client ID is not matching"
        );
        expect(testProfile["clientSecret"]).to.equal(
          "",
          "Client Secret is not matching"
        );
        expect(testProfile["context"]).to.equal(
          "SAS Studio context",
          "Compute Context is not matching"
        );
      });

      it("update single element of the profile", async function () {
        // Arrange
        let testProfile = await profileConfig.getProfileByName(testProfileName);

        // Act
        // update profile manually
        testProfile["endpoint"] = "https://test2-host.sas.com";
        await profileConfig.upsertProfile(testProfileName, testProfile);
        testProfile = await profileConfig.getProfileByName(testProfileName);

        // Assert
        // validate host has changed and clientId and token is still empty
        expect(testProfile["endpoint"]).to.equal("https://test2-host.sas.com");
        expect(testProfile["clientId"]).to.equal("sas.test");
        expect(testProfile).to.not.have.any.keys("token");
      });

      it("update profile from clientId to token", async function () {
        // Arrange
        await profileConfig.upsertProfile(testProfileNewName, <Profile>{
          endpoint: "https://test-host2.sas.com",
          context: "SAS Studio context",
        });
        let testProfile = await profileConfig.getProfileByName(testProfileName);
        const profileClone = { ...testProfile };

        // Act
        // update a profile to a new token file
        profileClone["clientId"] = "";
        profileClone["token"] = "path/to/token.txt";
        // Call to sanitize input
        await profileConfig.upsertProfile(testProfileName, profileClone);
        testProfile = await profileConfig.getProfileByName(testProfileName);

        // Assert
        // validate that the client id and secret have been removed and the token exists
        expect(testProfile).to.not.have.any.keys("clientId", "clientSecret");
        expect(testProfile).to.have.any.keys("token");

        // validate that the newly inserted profile still exists
        const testProfileNew = await profileConfig.getProfileByName(
          testProfileNewName
        );
        expect(testProfileNew["endpoint"]).to.equal(
          "https://test-host2.sas.com",
          "Host is not matching"
        );
      });
    });

    describe("Validate Profile", async function () {
      it("set active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);

        // Assert
        const testProfile = profileConfig.getActiveProfile();
        expect(testProfileName).to.equal(
          testProfile,
          "Active profile not successfully set"
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile = profileConfig.getProfileByName(activeProfileName);

        // Assert
        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set"
        );
        expect(
          activeProfile["endpoint"],
          "https://test-host.sas.com",
          "Active profile endpoint not expected"
        );
      });

      it("validate client id/secret profile", async function () {
        // Arrange
        const profileByName = profileConfig.getProfileByName(testProfileName);

        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: profileByName,
        });

        // Assert
        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.Password,
          "client id/secret profile did not return correct AuthType"
        );
        expect(validateProfile.error).to.equal(
          "",
          "client id/secret profile should not return error"
        );
      });
    });
  });

  describe("Token File Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      testProfileNewName = "testProfile2";
      await initProfile();
      await workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testProfileTokenFile,
          ConfigurationTarget.Global
        );
    });
    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        // Arrange
        // Act
        await profileConfig.upsertProfile(testProfileNewName, <Profile>{
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
        });
        const profiles = profileConfig.listProfile();

        // Assert
        expect(profiles).to.have.length(
          2,
          "A second profile should be in the list"
        );
        expect(profiles).to.include(
          testProfileNewName,
          `Profile ${testProfileName} should exist`
        );
      });

      it("delete a profile", async function () {
        // Arrange
        // Act
        await profileConfig.deleteProfile(testProfileName);

        // Assert
        const profiles = profileConfig.listProfile();
        expect(profiles).to.have.length(0);
      });

      it("get profile by name", async function () {
        // Arrange
        // Act
        const testProfile = profileConfig.getProfileByName(testProfileName);

        // Assert
        expect(testProfile["endpoint"]).to.equal(
          "https://test-host.sas.com",
          "Host is not matching"
        );
        expect(testProfile["token"]).to.equal("path/to/token.txt");
        expect(testProfile["context"]).to.equal(
          "SAS Studio context",
          "Compute Context is not matching"
        );
      });

      it("list the expected profiles", async function () {
        // Arrange
        // Act
        const profileList = profileConfig.listProfile();

        // Assert
        expect(profileList).to.eql(
          [testProfileName],
          "Expected profile name does not exist "
        );
      });

      it("update single element of the profile", async function () {
        // Arrange
        let testProfile = profileConfig.getProfileByName(testProfileName);

        // Act
        // update profile manually
        const newProfileSetting = testProfileTokenFile;
        newProfileSetting['profiles'][testProfileName]['endpoint'] = "https://test2-host.sas.com";
        await workspace
          .getConfiguration(EXTENSION_CONFIG_KEY)
          .update(
            EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
            newProfileSetting,
            ConfigurationTarget.Global
          );
        // get profile after settings update
        testProfile = profileConfig.getProfileByName(testProfileName);

        // Assert
        // validate host has changed, token hasn't changed, and the clientId still doesn't exist
        expect(testProfile["endpoint"]).to.equal("https://test2-host.sas.com");
        expect(testProfile["token"]).to.equal("path/to/token.txt");
        expect(testProfile).to.not.have.any.keys("clientId");
      });

      it("update profile from token to client id/secret", async function () {
        // Arrange
        await profileConfig.upsertProfile(testProfileNewName, <Profile>{
          endpoint: "https://test-host2.sas.com",
          context: "SAS Studio context",
        });
        let testProfile = await profileConfig.getProfileByName(testProfileName);
        const profileClone = { ...testProfile };

        // Act
        // update profile back to clientId
        profileClone["clientId"] = "sas.test";
        // Call to sanitize
        await profileConfig.upsertProfile(testProfileName, profileClone);
        testProfile = await profileConfig.getProfileByName(testProfileName);

        // Verify
        // validate that the token have been removed and the client id/secret exists
        expect(testProfile).to.have.any.keys("clientId", "clientSecret");
        expect(testProfile).to.not.have.any.keys("token");

        // validate that the newly inserted profile still exists
        const testProfileNew = await profileConfig.getProfileByName(
          testProfileNewName
        );
        expect(testProfileNew["endpoint"]).to.equal(
          "https://test-host2.sas.com",
          "Host is not matching"
        );
      });
    });

    describe("Validate Profile", async function () {
      beforeEach(async () => {
        testProfileName = "testProfile";
        await initProfile();
        await workspace
          .getConfiguration(EXTENSION_CONFIG_KEY)
          .update(
            EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
            testProfileTokenFile,
            ConfigurationTarget.Global
          );
      });
      it("set active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);

        // Assert
        const testProfile = profileConfig.getActiveProfile();
        expect(testProfileName).to.equal(
          testProfile,
          "Active profile not successfully set"
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile = profileConfig.getProfileByName(activeProfileName);

        // Assert
        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set"
        );
        expect(
          activeProfile["endpoint"],
          "https://test-host.sas.com",
          "Active profile endpoint not expected"
        );
      });

      it("validate token file profile", async function () {
        // Arrange
        const profileByName = profileConfig.getProfileByName(testProfileName);
        // Inject valid token file from testFixture/TestToken.txt to profile
        profileByName["token"] = testToken;

        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: profileByName,
        });

        // Assert
        expect(validateProfile.data).to.equal(readFileSync(testToken, "utf-8"));
        expect(validateProfile.type).to.equal(
          AuthType.TokenFile,
          "Token file profile did not return correct AuthType"
        );
        expect(validateProfile.error).to.equal(
          "",
          "Token file profile should not return error"
        );
      });

      it("validate bad path for token file profile", async function () {
        // Arrange
        // Profile already has incorrect token file
        const testProfile = profileConfig.getProfileByName(testProfileName);

        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: testProfile,
        });

        // Verify
        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.Error,
          "Bad token path profile did not return correct AuthType"
        );
        expect(validateProfile.error).to.equal(
          `Please update profile (${testProfileName}): ENOENT: no such file or directory, open '${testProfile["token"]}'`,
          "Bad token path profile should return error"
        );
      });
    });
  });

  describe("Empty File Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      testProfileNewName = "testProfile2";
      await initProfile();
      await workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testEmptyProfile,
          ConfigurationTarget.Global
        );
    });
    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        // Arrange
        // Act
        await profileConfig.upsertProfile(testProfileNewName, <Profile>{
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
        });
        const profiles = profileConfig.listProfile();

        // Assert
        expect(profiles).to.have.length(
          2,
          "A second profile should be in the list"
        );
        expect(profiles).to.include(
          testProfileNewName,
          `Profile ${testProfileName} should exist`
        );
      });

      it("delete a profile", async function () {
        // Arrange
        // Act
        await profileConfig.deleteProfile(testProfileName);

        // Assert
        const profiles = profileConfig.listProfile();
        expect(profiles).to.have.length(0);
      });

      it("get profile by name", async function () {
        // Arrange
        // Act
        const testProfile = profileConfig.getProfileByName(testProfileName);

        // Assert
        expect(testProfile["endpoint"]).to.equal(
          undefined,
          "Host is not matching"
        );
        expect(testProfile["context"]).to.equal(
          undefined,
          "Compute Context is not matching"
        );
      });

      it("list the expected profiles", async function () {
        // Arrange
        // Act
        const profileList = profileConfig.listProfile();

        // Assert
        expect(profileList).to.eql(
          [testProfileName],
          "Expected profile name does not exist"
        );
      });

      it("update single element of the profile", async function () {
        // Arrange
        let testProfile = profileConfig.getProfileByName(testProfileName);

        // Act
        // update profile manually
        const newProfileSetting = testEmptyProfile;
        newProfileSetting['profiles'][testProfileName]['endpoint'] = "https://test2-host.sas.com";
        await workspace
          .getConfiguration(EXTENSION_CONFIG_KEY)
          .update(
            EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
            newProfileSetting,
            ConfigurationTarget.Global
          );
        // get profile after settings update
        testProfile = profileConfig.getProfileByName(testProfileName);

        // Assert
        // validate that endpoint was added
        expect(testProfile["endpoint"]).to.equal("https://test2-host.sas.com");
      });

      it("validate no active profile when empty", async function () {
        // Arrange
        const testProfile = profileConfig.getProfileByName(testProfileName);

        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: testProfile,
        });

        // Assert
        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.Error,
          "Empty profile did not return correct AuthType"
        );
        expect(validateProfile.error).to.equal(
          "No token or client found",
          "Empty profile should return error"
        );
      });
    });

    describe("Validate Profiles", async function () {
      it("validate no active profile when only name sent in", async function () {
        // Arrange
        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: undefined,
        });

        // Assert
        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.Error,
          "No active profile did not return correct AuthType"
        );
        expect(validateProfile.error).to.equal(
          "No Active Profile",
          "No active profile did not return error"
        );
      });

      it("get active profile when no profile active", async function () {
        // Arrange
        // Act
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile = profileConfig.getProfileByName(activeProfileName);

        // Assert
        expect(activeProfile).to.be.equal(
          undefined,
          "No active profile should be found"
        );
      });
    });
  });
  describe("Overloaded Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      await initProfile();
        await workspace
          .getConfiguration(EXTENSION_CONFIG_KEY)
          .update(
            EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
            testOverloadedProfile,
            ConfigurationTarget.Global
          );
    });
    describe("Validate Profiles", async function () {
      it("set active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfile = profileConfig.getActiveProfile(); 

        // Assert
        expect(activeProfile).to.equal(
          testProfileName,
          "Active profile not successfully set"
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile = profileConfig.getProfileByName(activeProfileName);

        // Assert
        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set"
        );
        expect(
          activeProfile["endpoint"],
          "https://test-host.sas.com",
          "Active profile endpoint not expected"
        );
      });

      it("validate overloaded file profile", async function () {
        // Arrange
        const profileByName = profileConfig.getProfileByName(testProfileName);

        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: profileByName,
        });

        // Assert
        // Overloaded file should take password as precedence
        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.Password,
          "validate overloaded file profile did not return correct AuthType"
        );
        expect(validateProfile.error).to.equal(
          "",
          "validate overloaded file profile should not return error"
        );
      });
    });
  });

  describe("Empty Item Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      await initProfile();
        await workspace
          .getConfiguration(EXTENSION_CONFIG_KEY)
          .update(
            EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
            testEmptyItemsProfile,
            ConfigurationTarget.Global
          );
    });
    describe("Validate Profiles", async function () {
      it("set active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName); 
        const testProfile = profileConfig.getActiveProfile();

        // Assert
        expect(testProfile).to.equal(
          testProfileName,
          "Active profile not successfully set"
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile = profileConfig.getProfileByName(activeProfileName);

        // Assert
        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set"
        );
        expect(
          activeProfile["endpoint"],
          "",
          "Active profile endpoint not expected"
        );
      });

      it("validate empty file profile", async function () {
        // Arrange
        const testProfile = profileConfig.getProfileByName(testProfileName);

        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: testProfile,
        });

        // Assert
        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.Error,
          "empty file profile did not return correct AuthType"
        );
        expect(validateProfile.error).to.equal(
          "No token or client found",
          "empty file profile should return error"
        );
      });

      it("validate all empty items for profile", async function () {
        // Arrange
        const testProfile = profileConfig.getProfileByName(testProfileName);

        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: testProfile,
        });

        // Assert
        // Overloaded file should take token as precedence
        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.Error,
          "validate empty item profile did not return correct AuthType"
        );
        expect(validateProfile.error).to.equal(
          "No token or client found",
          "validate empty item should return error"
        );
      });
    });
  });

  describe("Input Prompts", async function () {
    it("Valid Profile Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.Profile);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "Switch Current SAS Profile",
        "Profile title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Select a SAS connection profile",
        "Profile placeholder does not match expected"
      );
    });

    it("Valid New Profile Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.NewProfile);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "New SAS Connection Profile Name",
        "NewProfile title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter connection name",
        "NewProfile placeholder does not match expected"
      );
    });

    it("Valid Endpoint Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.Endpoint);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "SAS Viya Server",
        "Endpoint title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter the URL",
        "Endpoint placeholder does not match expected"
      );
    });

    it("Valid Compute Context Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.ComputeContext);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "SAS Compute Context",
        "ComputeContext title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter the SAS compute context",
        "ComputeContext placeholder does not match expected"
      );
    });

    it("Valid Client Id Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.ClientId);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "Client ID",
        "ClientId title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter a client ID",
        "ClientId placeholder does not match expected"
      );
    });

    it("Valid Client Secret Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.ClientSecret);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "Client Secret",
        "ClientSecret title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter a client secret",
        "ClientSecret placeholder does not match expected"
      );
    });

    it("Valid Username Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.Username);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "SAS User ID",
        "Username title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter your SAS User ID",
        "Username placeholder does not match expected"
      );
    });

    it("Valid Password Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.Password);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "SAS Password",
        "Password title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter your SAS Password for the User ID ",
        "Password placeholder does not match expected"
      );
    });

    it("Valid Token File Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.TokenFile);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "SAS Access Token",
        "TokenFile title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter the path to the SAS token file",
        "TokenFile placeholder does not match expected"
      );
    });
  });
});
