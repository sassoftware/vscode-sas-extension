import { ConfigurationTarget, workspace } from "vscode";

import { assert, expect } from "chai";

import {
  AuthType,
  COMProfile,
  ConnectionType,
  EXTENSION_CONFIG_KEY,
  EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
  ProfileConfig,
  ProfilePromptType,
  SSHProfile,
  ViyaProfile,
  getProfilePrompt,
} from "../../../src/components/profile";

let testProfileName: string;
let testProfileNewName: string;
let profileConfig: ProfileConfig;
let testProfileClientId;
let testOverloadedProfile;
let testEmptyProfile;
let testEmptyItemsProfile;
let testSSHProfile;
let testCOMProfile;
let legacyProfile;

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
        ConfigurationTarget.Global,
      );
    testProfileClientId = {
      activeProfile: "",
      profiles: {
        testProfile: {
          endpoint: "https://test-host.sas.com",
          clientId: "sas.test",
          clientSecret: "",
          context: "SAS Studio context",
          connectionType: "rest",
        },
      },
    };
    testEmptyProfile = {
      activeProfile: "",
      profiles: {
        testProfile: {},
      },
    };
    testEmptyItemsProfile = {
      activeProfile: "",
      profiles: {
        testProfile: {
          endpoint: "",
          context: "",
          clientId: "",
          clientSecret: "",
        },
      },
    };
    testOverloadedProfile = {
      activeProfile: "",
      profiles: {
        testProfile: {
          endpoint: "https://test-host.sas.com",
          clientId: "sas.test",
          clientSecret: "",
          context: "SAS Studio context",
          username: "sastest",
          tokenFile: "path/to/token.txt",
          connectionType: "rest",
        },
      },
    };
    testSSHProfile = {
      activeProfile: "",
      profiles: {
        testProfile: {
          host: "host",
          username: "username",
          port: 22,
          sasPath: "sasPath",
          sasOptions: ["-nonews"],
          connectionType: "ssh",
          privateKeyFilePath: "/private/key/file/path",
        },
      },
    };

    testCOMProfile = {
      activeProfile: "",
      profiles: {
        testProfile: {
          host: "host",
          sasOptions: [],
          ConnectionType: "com",
        },
      },
    };
    legacyProfile = {
      activeProfile: "",
      profiles: {
        testSSHProfile: {
          host: "host",
          username: "username",
          port: 22,
          sasPath: "sasPath",
          sasOptions: ["-nonews"],
          connectionType: "ssh",
        },
        testViyaProfile: {
          endpoint: "https://test-host.sas.com/",
          clientId: "sas.test",
          clientSecret: "",
          context: "SAS Studio context",
          username: "sastest",
          tokenFile: "path/to/token.txt",
        },
        testProfile: {
          endpoint: "",
          context: "",
          clientId: "",
          clientSecret: "",
        },
      },
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

  describe("Legacy Profile", async function () {
    beforeEach(async () => {
      await initProfile();
      await workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          legacyProfile,
          ConfigurationTarget.Global,
        );
    });

    this.afterEach(async () => {
      await workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          undefined,
          ConfigurationTarget.Global,
        );
    });

    it("adds connectionType to legacy profiles", async () => {
      await profileConfig.migrateLegacyProfiles();

      const profiles = profileConfig.getAllProfiles();
      expect(Object.keys(profiles).length).to.be.greaterThan(0);

      for (const key in profiles) {
        const profile = profiles[key];
        if (profile.connectionType === undefined) {
          assert.fail(`Found undefined connectionType in profile named ${key}`);
        }
      }
    });

    it("removes trailing slash from endpoint on legacy profiles", async () => {
      await profileConfig.migrateLegacyProfiles();

      const profiles = profileConfig.getAllProfiles();
      expect(Object.keys(profiles).length).to.be.greaterThan(0);

      for (const key in profiles) {
        const profile = profiles[key];
        if (
          profile.connectionType === ConnectionType.Rest &&
          /\/$/.test(profile.endpoint)
        ) {
          assert.fail(
            `Found trailing slash in endpoint of profile named ${key}`,
          );
        }
      }
    });

    it("fails to validate missing connectionType", async () => {
      // Arrange

      const profileByName = profileConfig.getProfileByName("testViyaProfile");

      // Act
      const validateProfile = await profileConfig.validateProfile({
        name: testProfileName,
        profile: profileByName,
      });

      // Assert
      expect(validateProfile.data).to.equal(undefined);
      expect(validateProfile.type).to.equal(
        AuthType.Error,
        "legacy profile did not return correct AuthType",
      );
      expect(validateProfile.error).to.equal(
        "Missing connectionType in active profile.",
        "should return messing connectionType error",
      );
    });
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
        const profileLen = profileConfig.length();

        // Verify
        expect(profileLen).to.equal(0, "No profiles should exist");
      });

      it("add a new viya profile", async function () {
        // Arrange
        // Act
        await profileConfig.upsertProfile(testProfileNewName, {
          connectionType: ConnectionType.Rest,
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
        });
        const profiles = await profileConfig.listProfile();

        // Assert
        expect(profiles).to.have.length(
          1,
          "A single profile should be in the list",
        );

        expect(profiles).to.include(
          testProfileNewName,
          `Profile ${testProfileName} should exist`,
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
          ConfigurationTarget.Global,
        );
    });

    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        // Arrange
        // Act
        await profileConfig.upsertProfile(testProfileNewName, {
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
          connectionType: ConnectionType.Rest,
        });
        const profilesList = await profileConfig.listProfile();

        // Assert
        expect(profilesList).to.have.length(
          2,
          "A second profile should be in the list",
        );
        expect(profilesList).to.include(
          testProfileNewName,
          `Profile ${testProfileNewName} should exist`,
        );
        expect(profilesList).to.include(
          testProfileName,
          `Profile ${testProfileName} should exist`,
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
          "Expected profile name does not exist",
        );
      });

      it("get profile by name", async function () {
        // Arrange
        // Act
        const testProfile: ViyaProfile =
          profileConfig.getProfileByName(testProfileName);

        // Assert
        expect(testProfile.endpoint).to.equal(
          "https://test-host.sas.com",
          "Host is not matching",
        );
        expect(testProfile.clientId).to.equal(
          "sas.test",
          "Client ID is not matching",
        );
        expect(testProfile.clientSecret).to.equal(
          "",
          "Client Secret is not matching",
        );
        expect(testProfile.context).to.equal(
          "SAS Studio context",
          "Compute Context is not matching",
        );
      });

      it("update single element of the profile", async function () {
        // Arrange
        let testProfile: ViyaProfile =
          profileConfig.getProfileByName(testProfileName);

        // Act
        // update profile manually
        testProfile.endpoint = "https://test2-host.sas.com";
        await profileConfig.upsertProfile(testProfileName, testProfile);
        testProfile = profileConfig.getProfileByName(testProfileName);

        // Assert
        // validate host has changed and clientId and token is still empty
        expect(testProfile.endpoint).to.equal("https://test2-host.sas.com");
        expect(testProfile.clientId).to.equal("sas.test");
        expect(testProfile).to.not.have.any.keys("tokenFile");
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
          "Active profile not successfully set",
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile: ViyaProfile =
          profileConfig.getProfileByName(activeProfileName);

        // Assert
        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set",
        );
        expect(activeProfile.endpoint).to.equal(
          "https://test-host.sas.com",
          "Active profile endpoint not expected",
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
          AuthType.AuthCode,
          "client id/secret profile did not return correct AuthType",
        );
        expect(validateProfile.error).to.equal(
          "",
          "client id/secret profile should not return error",
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
          ConfigurationTarget.Global,
        );
    });
    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        const newProfile: ViyaProfile = {
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
          connectionType: ConnectionType.Rest,
        };
        // Arrange
        // Act
        await profileConfig.upsertProfile(testProfileNewName, newProfile);
        const profiles = profileConfig.listProfile();

        // Assert
        expect(profiles).to.have.length(
          2,
          "A second profile should be in the list",
        );
        expect(profiles).to.include(
          testProfileNewName,
          `Profile ${testProfileName} should exist`,
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
        const testProfile: ViyaProfile =
          profileConfig.getProfileByName(testProfileName);

        // Assert
        expect(testProfile.endpoint).to.equal(
          undefined,
          "Host is not matching",
        );
        expect(testProfile.context).to.equal(
          undefined,
          "Compute Context is not matching",
        );
      });

      it("list the expected profiles", async function () {
        // Arrange
        // Act
        const profileList = profileConfig.listProfile();

        // Assert
        expect(profileList).to.eql(
          [testProfileName],
          "Expected profile name does not exist",
        );
      });

      it("update single element of the profile", async function () {
        // Arrange
        let testProfile: ViyaProfile =
          profileConfig.getProfileByName(testProfileName);

        // Act
        // update profile manually
        const newProfileSetting = testEmptyProfile;
        newProfileSetting.profiles[testProfileName].endpoint =
          "https://test2-host.sas.com";
        await workspace
          .getConfiguration(EXTENSION_CONFIG_KEY)
          .update(
            EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
            newProfileSetting,
            ConfigurationTarget.Global,
          );
        // get profile after settings update
        testProfile = profileConfig.getProfileByName(testProfileName);

        // Assert
        // validate that endpoint was added
        expect(testProfile.endpoint).to.equal("https://test2-host.sas.com");
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
          "No active profile did not return correct AuthType",
        );
        expect(validateProfile.error).to.equal(
          "No Active Profile",
          "No active profile did not return error",
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
          "No active profile should be found",
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
          ConfigurationTarget.Global,
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
          "Active profile not successfully set",
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile: ViyaProfile =
          profileConfig.getProfileByName(activeProfileName);

        // Assert
        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set",
        );
        expect(activeProfile.endpoint).to.equal(
          "https://test-host.sas.com",
          "Active profile endpoint not expected",
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
        // Overloaded file should take authcode as precedence
        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.AuthCode,
          "validate overloaded file profile did not return correct AuthType",
        );
        expect(validateProfile.error).to.equal(
          "",
          "validate overloaded file profile should not return error",
        );
      });
    });
  });

  describe("SSH Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      testProfileNewName = "testProfile2";
      await initProfile();
      await workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testSSHProfile,
          ConfigurationTarget.Global,
        );
    });
    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        const requestSSHProfile: SSHProfile = {
          connectionType: ConnectionType.SSH,
          host: "ssh.host",
          port: 22,
          sasOptions: ["-nonews"],
          saspath: "/sas/path",
          username: "username",
          privateKeyFilePath: "/private/key/file/path",
        };
        // Arrange
        // Act
        await profileConfig.upsertProfile(
          testProfileNewName,
          requestSSHProfile,
        );
        const profilesList = profileConfig.listProfile();

        // Assert
        expect(profilesList).to.have.length(
          2,
          "A second profile should be in the list",
        );
        expect(profilesList).to.include(
          testProfileNewName,
          `Profile ${testProfileNewName} should exist`,
        );
        expect(profilesList).to.include(
          testProfileName,
          `Profile ${testProfileName} should exist`,
        );

        const addedProfile: SSHProfile =
          profileConfig.getProfileByName(testProfileNewName);

        expect(addedProfile).to.eql(
          requestSSHProfile,
          `Profile ${testProfileNewName} should have expected contents after creation`,
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
          "Expected ssh profile name does not exist",
        );
      });
    });
  });

  describe("COM Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      testProfileNewName = "testProfile2";
      await initProfile();
      await workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testCOMProfile,
          ConfigurationTarget.Global,
        );
    });
    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        const requestCOMProfile: COMProfile = {
          connectionType: ConnectionType.COM,
          host: "com.host",
          sasOptions: ["-nonews"],
        };
        // Arrange
        // Act
        await profileConfig.upsertProfile(
          testProfileNewName,
          requestCOMProfile,
        );
        const profilesList = profileConfig.listProfile();

        // Assert
        expect(profilesList).to.have.length(
          2,
          "A second profile should be in the list",
        );
        expect(profilesList).to.include(
          testProfileNewName,
          `Profile ${testProfileNewName} should exist`,
        );
        expect(profilesList).to.include(
          testProfileName,
          `Profile ${testProfileName} should exist`,
        );

        const addedProfile: COMProfile =
          profileConfig.getProfileByName(testProfileNewName);

        expect(addedProfile).to.eql(
          requestCOMProfile,
          `Profile ${testProfileNewName} should have expected contents after creation`,
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
          "Expected com profile name does not exist",
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
          ConfigurationTarget.Global,
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
          "Active profile not successfully set",
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile: ViyaProfile =
          profileConfig.getProfileByName(activeProfileName);

        // Assert
        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set",
        );
        expect(activeProfile.endpoint).to.equal(
          "",
          "Active profile endpoint not expected",
        );
      });
    });
  });

  describe("Viya Input Prompts", async function () {
    it("Valid Profile Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.Profile);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result.title).to.equal(
        "Switch Current SAS Profile",
        "Profile title does not match expected",
      );
      expect(result.placeholder).to.equal(
        "Select a SAS connection profile",
        "Profile placeholder does not match expected",
      );
    });

    it("Valid New Profile Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.NewProfile);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result.title).to.equal(
        "New SAS Connection Profile Name",
        "NewProfile title does not match expected",
      );
      expect(result.placeholder).to.equal(
        "Enter connection name",
        "NewProfile placeholder does not match expected",
      );
    });

    it("Valid Endpoint Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.Endpoint);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result.title).to.equal(
        "SAS Viya Server",
        "Endpoint title does not match expected",
      );
      expect(result.placeholder).to.equal(
        "Enter the URL",
        "Endpoint placeholder does not match expected",
      );
    });

    it("Valid Compute Context Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.ComputeContext);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result.title).to.equal(
        "SAS Compute Context",
        "ComputeContext title does not match expected",
      );
      expect(result.placeholder).to.equal(
        "Enter the SAS compute context",
        "ComputeContext placeholder does not match expected",
      );
    });

    it("Valid Client Id Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.ClientId);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result.title).to.equal(
        "Client ID",
        "ClientId title does not match expected",
      );
      expect(result.placeholder).to.equal(
        "Enter a client ID",
        "ClientId placeholder does not match expected",
      );
    });

    it("Valid Client Secret Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.ClientSecret);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result.title).to.equal(
        "Client Secret",
        "ClientSecret title does not match expected",
      );
      expect(result.placeholder).to.equal(
        "Enter a client secret",
        "ClientSecret placeholder does not match expected",
      );
    });
  });

  describe("SSH Input Prompts", async function () {
    interface testCase {
      name: string;
      prompt: ProfilePromptType;
      wantTitle: string;
      wantPlaceHolder: string;
      wantDescription: string;
    }
    const testCases: testCase[] = [
      {
        name: "Host",
        prompt: ProfilePromptType.Host,
        wantTitle: "SAS 9 Server",
        wantDescription: "Enter the name of the SAS 9 server.",
        wantPlaceHolder: "Enter the server name",
      },
      {
        name: "SAS Path",
        prompt: ProfilePromptType.SASPath,
        wantTitle: "Server Path",
        wantDescription: "Enter the server path of the SAS Executable.",
        wantPlaceHolder: "Enter the server path",
      },
      {
        name: "Port",
        prompt: ProfilePromptType.Port,
        wantTitle: "Port Number",
        wantDescription: "Enter a port number.",
        wantPlaceHolder: "Enter a port number",
      },
      {
        name: "Username",
        prompt: ProfilePromptType.Username,
        wantTitle: "SAS Server Username",
        wantDescription: "Enter your SAS server username.",
        wantPlaceHolder: "Enter your username",
      },
      {
        name: "Private Key File Path",
        prompt: ProfilePromptType.PrivateKeyFilePath,
        wantTitle: "Private Key File Path (optional)",
        wantDescription: "Leave empty to use SSH Agent or password.",
        wantPlaceHolder: "Enter the local private key file path",
      },
    ];

    testCases.forEach((testCase) => {
      it(`Valid ${testCase.name} Input`, function () {
        const foundPrompt = getProfilePrompt(testCase.prompt);
        expect(foundPrompt).to.not.equal(undefined);

        expect(foundPrompt.title).to.equal(
          testCase.wantTitle,
          `${testCase.name} title does not match expected`,
        );
        expect(foundPrompt.placeholder).to.equal(
          testCase.wantPlaceHolder,
          `${testCase.name} placeholder does not match expected`,
        );
        expect(foundPrompt.description).to.equal(
          testCase.wantDescription,
          `${testCase.name} description does not match expected`,
        );
      });
    });
  });
});
