import {
  Profile,
  ProfileConfig,
  getProfilePrompt,
  ProfilePromptType,
  AuthType,
} from "../src/viya/profile";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { expect } from "chai";
import path = require("path");

let testProfileName: string;
let testProfileNewName: string;
let testProfile: string;
let testToken: string;
let profileConfig: ProfileConfig;
let testProfileClientId: ProfileConfig;
let testProfileTokenFile: ProfileConfig;
let testOverloadedProfile: ProfileConfig;
let testEmptyProfile: ProfileConfig;
let testEmptyItemsProfile: ProfileConfig;

async function initProfile(): Promise<void> {
  profileConfig = new ProfileConfig(testProfile, function () {
    return {};
  });
  // initializes profileConfig
  await profileConfig.get();
}

describe("Profiles", async function () {
  before(async () => {
    testProfile = path.join(
      __dirname,
      "..",
      "..",
      "testFixture",
      "testProfile.json"
    );
    testToken = path.resolve(
      path.join(__dirname, "..", "..", "testFixture", "TestToken.txt")
    );
    testProfileClientId = <ProfileConfig>(
      (<undefined>(
        readFileSync(
          path.join(
            __dirname,
            "..",
            "..",
            "testFixture",
            "profiles",
            "testProfileClientId.json"
          ),
          { encoding: "utf-8" }
        )
      ))
    );
    testProfileTokenFile = <ProfileConfig>(
      (<undefined>(
        readFileSync(
          path.join(
            __dirname,
            "..",
            "..",
            "testFixture",
            "profiles",
            "testProfileTokenFile.json"
          ),
          { encoding: "utf-8" }
        )
      ))
    );
    testEmptyProfile = <ProfileConfig>(
      (<undefined>(
        readFileSync(
          path.join(
            __dirname,
            "..",
            "..",
            "testFixture",
            "profiles",
            "testEmptyProfile.json"
          ),
          { encoding: "utf-8" }
        )
      ))
    );
    testEmptyItemsProfile = <ProfileConfig>(
      (<undefined>(
        readFileSync(
          path.join(
            __dirname,
            "..",
            "..",
            "testFixture",
            "profiles",
            "testEmptyItemsProfile.json"
          ),
          { encoding: "utf-8" }
        )
      ))
    );
    testOverloadedProfile = <ProfileConfig>(
      (<undefined>(
        readFileSync(
          path.join(
            __dirname,
            "..",
            "..",
            "testFixture",
            "profiles",
            "testOverloadedProfile.json"
          ),
          { encoding: "utf-8" }
        )
      ))
    );
  });

  afterEach(async () => {
    if (testProfileName) {
      testProfileName = "";
    }
    if (testProfileNewName) {
      testProfileNewName = "";
    }
    if (existsSync(testProfile)) {
      unlinkSync(testProfile);
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
        profileConfig.upsertProfile(testProfileNewName, <Profile>{
          "compute-context": "https://test-host.sas.com",
          "sas-endpoint": "SAS Studio context",
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
      writeFileSync(testProfile, testProfileClientId);
      initProfile();
    });
    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        // Arrange
        // Act
        profileConfig.upsertProfile(testProfileNewName, <Profile>{
          "compute-context": "https://test-host.sas.com",
          "sas-endpoint": "SAS Studio context",
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
        const profileList = await profileConfig.listProfile();

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
        expect(testProfile["sas-endpoint"]).to.equal(
          "https://test-host.sas.com",
          "Host is not matching"
        );
        expect(testProfile["client-id"]).to.equal(
          "sas.test",
          "Client ID is not matching"
        );
        expect(testProfile["client-secret"]).to.equal(
          "",
          "Client Secret is not matching"
        );
        expect(testProfile["compute-context"]).to.equal(
          "SAS Studio context",
          "Compute Context is not matching"
        );
      });

      it("update single element of the profile", async function () {
        // Arrange
        let testProfile = await profileConfig.getProfileByName(testProfileName);

        // Act
        // update profile manually
        testProfile["sas-endpoint"] = "https://test2-host.sas.com";
        testProfile = await profileConfig.getProfileByName(testProfileName);

        // Assert
        // validate host has changed and client-id and token-file is still empty
        expect(testProfile["sas-endpoint"]).to.equal(
          "https://test2-host.sas.com"
        );
        expect(testProfile["client-id"]).to.equal("sas.test");
        expect(testProfile).to.not.have.any.keys("token-file");
      });

      it("update profile from client-id to token", async function () {
        // Arrange
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );

        // Act
        // update a profile to a new token file
        testProfile["client-id"] = "";
        testProfile["token-file"] = "path/to/token.txt";
        // Call to sanitize input
        await profileConfig.upsertProfile(testProfileName, testProfile);

        // Assert
        // validate that the client id and secret have been removed and the token-file exists
        expect(testProfile).to.not.have.any.keys("client-id", "client-secret");
        expect(testProfile).to.have.any.keys("token-file");
      });
    });

    describe("Validate Profile", async function () {
      it("set active profile", async function () {
        // Arrange
        // Act
        await profileConfig.setActiveProfile(testProfileName);

        // Assert
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );
        expect(testProfile["active"]).to.equal(
          true,
          "Active profile not successfully set"
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.setActiveProfile(testProfileName);
        const activeProfile = await profileConfig.getActiveProfile();

        // Assert
        expect(activeProfile["name"]).to.equal(
          testProfileName,
          "Active profile has not been set"
        );
        expect(
          activeProfile["profile"]["sas-endpoint"],
          "https://test-host.sas.com",
          "Active profile endpoint not expected"
        );
      });

      it("validate client id/secret profile", async function () {
        // Arrange
        const profileByName = await profileConfig.getProfileByName(
          testProfileName
        );

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
      writeFileSync(testProfile, testProfileTokenFile);
      initProfile();
    });
    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        // Arrange
        // Act
        profileConfig.upsertProfile(testProfileNewName, <Profile>{
          "compute-context": "https://test-host.sas.com",
          "sas-endpoint": "SAS Studio context",
        });
        const profiles = await profileConfig.listProfile();

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
        const profiles = await profileConfig.listProfile();
        expect(profiles).to.have.length(0);
      });

      it("get profile by name", async function () {
        // Arrange
        // Act
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );

        // Assert
        expect(testProfile["sas-endpoint"]).to.equal(
          "https://test-host.sas.com",
          "Host is not matching"
        );
        expect(testProfile["token-file"]).to.equal("path/to/token.txt");
        expect(testProfile["compute-context"]).to.equal(
          "SAS Studio context",
          "Compute Context is not matching"
        );
      });

      it("list the expected profiles", async function () {
        // Arrange
        // Act
        const profileList = await profileConfig.listProfile();

        // Assert
        expect(profileList).to.eql(
          [testProfileName],
          "Expected profile name does not exist "
        );
      });

      it("update single element of the profile", async function () {
        // Arrange
        let testProfile = await profileConfig.getProfileByName(testProfileName);

        // Act
        // update profile manually
        testProfile["sas-endpoint"] = "https://test2-host.sas.com";
        testProfile = await profileConfig.getProfileByName(testProfileName);

        // Assert
        // validate host has changed and token-file hasn't changed and the client-id still doesn't exist
        expect(testProfile["sas-endpoint"]).to.equal(
          "https://test2-host.sas.com"
        );
        expect(testProfile["token-file"]).to.equal("path/to/token.txt");
        expect(testProfile).to.not.have.any.keys("client-id");
      });

      it("update profile from token to client id/secret", async function () {
        // Arrange
        let testProfile = await profileConfig.getProfileByName(testProfileName);

        // Act
        // update profile back to client-id
        testProfile["client-id"] = "sas.test";
        // Call to sanitize
        await profileConfig.upsertProfile(testProfileName, testProfile);
        testProfile = await profileConfig.getProfileByName(testProfileName);

        // Verify
        // validate that the token-file have been removed and the client id/secret exists
        expect(testProfile).to.have.any.keys("client-id", "client-secret");
        expect(testProfile).to.not.have.any.keys("token-file");
      });
    });

    describe("Validate Profile", async function () {
      beforeEach(async () => {
        testProfileName = "testProfile";
        writeFileSync(testProfile, testProfileTokenFile);
        initProfile();
      });
      it("set active profile", async function () {
        // Arrange
        // Act
        await profileConfig.setActiveProfile(testProfileName);

        // Assert
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );
        expect(testProfile["active"]).to.equal(
          true,
          "Active profile not successfully set"
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.setActiveProfile(testProfileName);
        const activeProfile = await profileConfig.getActiveProfile();

        // Assert
        expect(activeProfile["name"]).to.equal(
          testProfileName,
          "Active profile has not been set"
        );
        expect(
          activeProfile["profile"]["sas-endpoint"],
          "https://test-host.sas.com",
          "Active profile endpoint not expected"
        );
      });

      it("validate token file profile", async function () {
        // Arrange
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );
        // Inject valid token file from testFixture/TestToken.txt to profile
        testProfile["token-file"] = testToken;

        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: testProfile,
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
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );

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
          `Please update profile (${testProfileName}): ENOENT: no such file or directory, open '${testProfile["token-file"]}'`,
          "Bad token path profile should return error"
        );
      });
    });
  });

  describe("Empty File Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      testProfileNewName = "testProfile2";
      writeFileSync(testProfile, testEmptyProfile);
      initProfile();
    });
    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        // Arrange
        // Act
        profileConfig.upsertProfile(testProfileNewName, <Profile>{
          "compute-context": "https://test-host.sas.com",
          "sas-endpoint": "SAS Studio context",
        });
        const profiles = await profileConfig.listProfile();

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
        const profiles = await profileConfig.listProfile();
        expect(profiles).to.have.length(0);
      });

      it("get profile by name", async function () {
        // Arrange
        // Act
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );

        // Assert
        expect(testProfile["sas-endpoint"]).to.equal(
          undefined,
          "Host is not matching"
        );
        expect(testProfile["compute-context"]).to.equal(
          undefined,
          "Compute Context is not matching"
        );
      });

      it("list the expected profiles", async function () {
        // Arrange
        // Act
        const profileList = await profileConfig.listProfile();

        // Assert
        expect(profileList).to.eql(
          [testProfileName],
          "Expected profile name does not exist"
        );
      });

      it("update single element of the profile", async function () {
        // Arrange
        let testProfile = await profileConfig.getProfileByName(testProfileName);

        // Act
        // update profile manually
        testProfile["sas-endpoint"] = "https://test2-host.sas.com";
        testProfile = await profileConfig.getProfileByName(testProfileName);

        // Assert
        // validate that sas-endpoint was added
        expect(testProfile["sas-endpoint"]).to.equal(
          "https://test2-host.sas.com"
        );
      });

      it("validate no active profile when empty", async function () {
        // Arrange
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );

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
        const activeProfile = await profileConfig.getActiveProfile();

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
      writeFileSync(testProfile, testOverloadedProfile);
      initProfile();
    });
    describe("Validate Profiles", async function () {
      it("set active profile", async function () {
        // Arrange
        // Act
        await profileConfig.setActiveProfile(testProfileName);

        // Assert
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );
        expect(testProfile["active"]).to.equal(
          true,
          "Active profile not successfully set"
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.setActiveProfile(testProfileName);
        const activeProfile = await profileConfig.getActiveProfile();

        // Assert
        expect(activeProfile["name"]).to.equal(
          testProfileName,
          "Active profile has not been set"
        );
        expect(
          activeProfile["profile"]["sas-endpoint"],
          "https://test-host.sas.com",
          "Active profile endpoint not expected"
        );
      });

      it("validate overloaded file profile", async function () {
        // Arrange
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );
        // Inject valid token file from testFixture/TestToken.txt to profile
        testProfile["token-file"] = testToken;

        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: testProfile,
        });

        // Assert
        // Overloaded file should take token as precedence
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
      writeFileSync(testProfile, testEmptyItemsProfile);
      initProfile();
    });
    describe("Validate Profiles", async function () {
      it("set active profile", async function () {
        // Arrange
        // Act
        await profileConfig.setActiveProfile(testProfileName);

        // Assert
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );
        expect(testProfile["active"]).to.equal(
          true,
          "Active profile not successfully set"
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.setActiveProfile(testProfileName);
        const activeProfile = await profileConfig.getActiveProfile();

        // Assert
        expect(activeProfile["name"]).to.equal(
          testProfileName,
          "Active profile has not been set"
        );
        expect(
          activeProfile["profile"]["sas-endpoint"],
          "https://test-host.sas.com",
          "Active profile endpoint not expected"
        );
      });

      it("validate empty file profile", async function () {
        // Arrange
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );

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
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );

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
        "Select a profile",
        "Profile title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Select Profile Name...",
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
        "Please enter new profile name",
        "NewProfile title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter New Profile Name...",
        "NewProfile placeholder does not match expected"
      );
    });

    it("Valid Hostname Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.HostName);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "Hostname for new profile (e.g. https://example.sas.com)",
        "Hostname title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter hostname...",
        "Hostname placeholder does not match expected"
      );
    });

    it("Valid Profile Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.UpdateHostname);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "Hostname for profile",
        "UpdateHostname title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter hostname...",
        "UpdateHostname placeholder does not match expected"
      );
    });

    it("Valid Compute Context Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.ComputeContext);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "Compute Context",
        "ComputeContext title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter Compute Context...",
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
        "Enter New Client ID...",
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
        "Enter Client Secret...",
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
        "SAS Username",
        "Username title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter a SAS Username...",
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
        "Enter a SAS Password...",
        "Password placeholder does not match expected"
      );
    });

    it("Valid Config File Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.ConfigFile);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "SAS Profile Config Path",
        "ConfigFile title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter Config File Path...",
        "ConfigFile placeholder does not match expected"
      );
    });

    it("Valid Token File Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.TokenFile);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "SAS Token File Path",
        "TokenFile title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter Token File Path...",
        "TokenFile placeholder does not match expected"
      );
    });
  });
});
