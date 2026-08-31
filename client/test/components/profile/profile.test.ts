import { ConfigurationTarget, workspace } from "vscode";

import { assert, expect } from "chai";
import { SinonSandbox, SinonStub, createSandbox } from "sinon";

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
        wantDescription: "To use the SSH Agent or a password, leave blank.",
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

  describe("Configuration Scope", async function () {
    const userSetting = {
      activeProfile: "userProfile",
      profiles: {
        userProfile: {
          connectionType: "rest",
          endpoint: "https://user-host.sas.com",
        },
      },
    };
    const workspaceSetting = {
      activeProfile: "workspaceProfile",
      profiles: {
        workspaceProfile: {
          connectionType: "rest",
          endpoint: "https://workspace-host.sas.com",
        },
        workspaceProfile2: {
          connectionType: "rest",
          endpoint: "https://workspace-host2.sas.com",
        },
      },
    };
    const workspaceFolderSetting = {
      activeProfile: "folderProfile",
      profiles: {
        folderProfile: {
          connectionType: "rest",
          endpoint: "https://folder-host.sas.com",
        },
      },
    };

    let sandbox: SinonSandbox;
    let updateStub: SinonStub;

    function stubConfiguration(
      inspectResult: Partial<{
        globalValue: unknown;
        workspaceValue: unknown;
        workspaceFolderValue: unknown;
      }>,
    ) {
      updateStub = sandbox.stub().resolves();

      const configuration = {
        get: sandbox.stub(),
        has: sandbox.stub(),
        inspect: sandbox.stub().returns({
          key: `${EXTENSION_CONFIG_KEY}.${EXTENSION_DEFINE_PROFILES_CONFIG_KEY}`,
          ...inspectResult,
        }),
        update: updateStub,
      };

      sandbox.stub(workspace, "getConfiguration").returns(configuration);
    }

    beforeEach(async () => {
      sandbox = createSandbox();
      await initProfile();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("prefers workspace profiles over user profiles", function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: workspaceSetting,
      });

      expect(profileConfig.getConfigurationTarget()).to.equal(
        ConfigurationTarget.Workspace,
      );
      expect(profileConfig.getActiveProfile()).to.equal("workspaceProfile");
      expect(Object.keys(profileConfig.getAllProfiles())).to.have.members([
        "workspaceProfile",
        "workspaceProfile2",
      ]);
    });

    it("prefers workspace folder profiles over workspace profiles", function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: workspaceSetting,
        workspaceFolderValue: workspaceFolderSetting,
      });

      expect(profileConfig.getConfigurationTarget()).to.equal(
        ConfigurationTarget.WorkspaceFolder,
      );
      expect(profileConfig.getActiveProfile()).to.equal("folderProfile");
      expect(Object.keys(profileConfig.getAllProfiles())).to.have.members([
        "folderProfile",
      ]);
    });

    it("switches the active profile in workspace settings", async function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: workspaceSetting,
      });

      await profileConfig.updateActiveProfileSetting("workspaceProfile2");

      expect(updateStub.calledOnce).to.equal(true);
      const [key, value, target] = updateStub.firstCall.args;
      expect(key).to.equal(EXTENSION_DEFINE_PROFILES_CONFIG_KEY);
      expect(value.activeProfile).to.equal("workspaceProfile2");
      expect(target).to.equal(ConfigurationTarget.Workspace);
    });

    it("writes profile changes to workspace settings", async function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: workspaceSetting,
      });

      await profileConfig.upsertProfile("workspaceProfile3", {
        connectionType: ConnectionType.Rest,
        endpoint: "https://workspace-host3.sas.com",
      });

      const [, value, target] = updateStub.firstCall.args;
      expect(Object.keys(value.profiles)).to.have.members([
        "workspaceProfile",
        "workspaceProfile2",
        "workspaceProfile3",
      ]);
      expect(target).to.equal(ConfigurationTarget.Workspace);
    });

    it("deletes profiles from workspace settings", async function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: workspaceSetting,
      });

      await profileConfig.deleteProfile("workspaceProfile2");

      const [, value, target] = updateStub.firstCall.args;
      expect(Object.keys(value.profiles)).to.have.members(["workspaceProfile"]);
      expect(target).to.equal(ConfigurationTarget.Workspace);
    });

    it("falls back to user settings when no workspace profiles exist", async function () {
      stubConfiguration({ globalValue: userSetting });

      expect(profileConfig.getConfigurationTarget()).to.equal(
        ConfigurationTarget.Global,
      );
      expect(profileConfig.getActiveProfile()).to.equal("userProfile");
      expect(Object.keys(profileConfig.getAllProfiles())).to.have.members([
        "userProfile",
      ]);

      await profileConfig.updateActiveProfileSetting("userProfile");
      expect(updateStub.firstCall.args[2]).to.equal(ConfigurationTarget.Global);
    });

    it("falls back to user profiles when workspace setting is empty", function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: {},
      });

      expect(profileConfig.getActiveProfile()).to.equal("userProfile");
      expect(Object.keys(profileConfig.getAllProfiles())).to.have.members([
        "userProfile",
      ]);
    });

    it("falls back to user profiles when workspace setting is an empty normalized structure", function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: { activeProfile: "", profiles: {} },
      });

      expect(profileConfig.getConfigurationTarget()).to.equal(
        ConfigurationTarget.Workspace,
      );
      expect(profileConfig.getActiveProfile()).to.equal("userProfile");
      expect(Object.keys(profileConfig.getAllProfiles())).to.have.members([
        "userProfile",
      ]);
    });

    it("does not fall back when workspace has a profile but no active profile", function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: {
          activeProfile: "",
          profiles: {
            testConn: {
              connectionType: "rest",
              endpoint: "https://daily.pgc.unx.sas.com",
            },
          },
        },
      });

      expect(profileConfig.getActiveProfile()).to.equal("");
      expect(Object.keys(profileConfig.getAllProfiles())).to.have.members([
        "testConn",
      ]);
    });

    it("does not modify user settings when workspace configuration is empty", function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: { activeProfile: "", profiles: {} },
      });

      profileConfig.getActiveProfile();
      profileConfig.getAllProfiles();

      expect(updateStub.called).to.equal(false);
    });

    it("does not clear the user's active profile during validation", function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: { activeProfile: "", profiles: {} },
      });

      const isValid = profileConfig.validateSettings();

      expect(isValid).to.equal(true);
      expect(updateStub.called).to.equal(false);
      expect(profileConfig.getActiveProfile()).to.equal("userProfile");
    });

    it("writes new profiles to workspace when workspace owns the setting even if empty", async function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: {},
      });

      await profileConfig.upsertProfile("workspaceProfile3", {
        connectionType: ConnectionType.Rest,
        endpoint: "https://workspace-host3.sas.com",
      });

      const [, , target] = updateStub.firstCall.args;
      expect(target).to.equal(ConfigurationTarget.Workspace);
    });

    it("normalizes a missing/empty workspace setting when no scope has profiles", function () {
      stubConfiguration({
        workspaceValue: {},
      });

      const isValid = profileConfig.validateSettings();

      expect(isValid).to.equal(false);
      expect(updateStub.calledOnce).to.equal(true);
      const [key, value, target] = updateStub.firstCall.args;
      expect(key).to.equal(EXTENSION_DEFINE_PROFILES_CONFIG_KEY);
      expect(value).to.eql({ activeProfile: "", profiles: {} });
      expect(target).to.equal(ConfigurationTarget.Workspace);
    });

    it("normalizes user settings when profiles are manually removed but activeProfile remains", function () {
      stubConfiguration({
        globalValue: { activeProfile: "userProfile", profiles: {} },
      });

      const isValid = profileConfig.validateSettings();

      expect(isValid).to.equal(false);
      expect(updateStub.calledOnce).to.equal(true);
      const [key, value, target] = updateStub.firstCall.args;
      expect(key).to.equal(EXTENSION_DEFINE_PROFILES_CONFIG_KEY);
      expect(value).to.eql({ activeProfile: "", profiles: {} });
      expect(target).to.equal(ConfigurationTarget.Global);
    });

    it("normalizes workspace settings when profiles are manually removed but activeProfile remains", function () {
      stubConfiguration({
        workspaceValue: { activeProfile: "workspaceProfile", profiles: {} },
      });

      const isValid = profileConfig.validateSettings();

      expect(isValid).to.equal(false);
      expect(updateStub.calledOnce).to.equal(true);
      const [key, value, target] = updateStub.firstCall.args;
      expect(key).to.equal(EXTENSION_DEFINE_PROFILES_CONFIG_KEY);
      expect(value).to.eql({ activeProfile: "", profiles: {} });
      expect(target).to.equal(ConfigurationTarget.Workspace);
    });

    it("normalizes workspace folder settings when profiles are manually removed but activeProfile remains", function () {
      stubConfiguration({
        workspaceFolderValue: { activeProfile: "folderProfile", profiles: {} },
      });

      const isValid = profileConfig.validateSettings();

      expect(isValid).to.equal(false);
      expect(updateStub.calledOnce).to.equal(true);
      const [key, value, target] = updateStub.firstCall.args;
      expect(key).to.equal(EXTENSION_DEFINE_PROFILES_CONFIG_KEY);
      expect(value).to.eql({ activeProfile: "", profiles: {} });
      expect(target).to.equal(ConfigurationTarget.WorkspaceFolder);
    });

    it("falls back to user profiles and normalizes a stale workspace folder setting", function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceFolderValue: {
          activeProfile: "folderProfile",
          profiles: {},
        },
      });

      expect(profileConfig.getActiveProfile()).to.equal("userProfile");

      expect(updateStub.calledOnce).to.equal(true);
      const [key, value, target] = updateStub.firstCall.args;
      expect(key).to.equal(EXTENSION_DEFINE_PROFILES_CONFIG_KEY);
      expect(value).to.eql({ activeProfile: "", profiles: {} });
      expect(target).to.equal(ConfigurationTarget.WorkspaceFolder);
    });

    it("leaves no stale activeProfile once profiles becomes empty", async function () {
      stubConfiguration({
        workspaceValue: { activeProfile: "workspaceProfile", profiles: {} },
      });

      profileConfig.validateSettings();

      const [, value] = updateStub.firstCall.args;
      expect(value.activeProfile).to.equal("");
      expect(value.profiles).to.eql({});
    });
  });

  describe("Profile Creation Target", async function () {
    const userSetting = {
      activeProfile: "userProfile",
      profiles: {
        userProfile: {
          connectionType: "rest",
          endpoint: "https://user-host.sas.com",
        },
      },
    };
    const workspaceSetting = {
      activeProfile: "workspaceProfile",
      profiles: {
        workspaceProfile: {
          connectionType: "rest",
          endpoint: "https://workspace-host.sas.com",
        },
      },
    };
    const workspaceFolderSetting = {
      activeProfile: "folderProfile",
      profiles: {
        folderProfile: {
          connectionType: "rest",
          endpoint: "https://folder-host.sas.com",
        },
      },
    };

    let sandbox: SinonSandbox;
    let updateStub: SinonStub;

    function stubConfiguration(
      inspectResult: Partial<{
        globalValue: unknown;
        workspaceValue: unknown;
        workspaceFolderValue: unknown;
      }>,
    ) {
      updateStub = sandbox.stub().resolves();

      const configuration = {
        get: sandbox.stub(),
        has: sandbox.stub(),
        inspect: sandbox.stub().returns({
          key: `${EXTENSION_CONFIG_KEY}.${EXTENSION_DEFINE_PROFILES_CONFIG_KEY}`,
          ...inspectResult,
        }),
        update: updateStub,
      };

      sandbox.stub(workspace, "getConfiguration").returns(configuration);
    }

    function stubWorkspaceFolders(count: number) {
      const folders =
        count === 0
          ? undefined
          : Array.from({ length: count }, (_, i) => ({
              uri: { fsPath: `/folder${i}` },
              name: `folder${i}`,
              index: i,
            }));
      sandbox.stub(workspace, "workspaceFolders").value(folders);
    }

    function newViyaProfile(endpoint: string): ViyaProfile {
      return { connectionType: ConnectionType.Rest, endpoint };
    }

    beforeEach(async () => {
      sandbox = createSandbox();
      await initProfile();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("creates a new profile in workspace settings when a workspace is open but has no connectionProfiles setting", async function () {
      stubConfiguration({ globalValue: userSetting });
      stubWorkspaceFolders(1);

      await profileConfig.upsertProfile(
        "newProfile",
        newViyaProfile("https://new-host.sas.com"),
      );

      const [, value, target] = updateStub.firstCall.args;
      expect(target).to.equal(ConfigurationTarget.Workspace);
      expect(Object.keys(value.profiles)).to.have.members(["newProfile"]);
    });

    it("creates a new profile in workspace settings when the workspace setting is empty", async function () {
      stubConfiguration({ globalValue: userSetting, workspaceValue: {} });
      stubWorkspaceFolders(1);

      await profileConfig.upsertProfile(
        "newProfile",
        newViyaProfile("https://new-host.sas.com"),
      );

      const [, , target] = updateStub.firstCall.args;
      expect(target).to.equal(ConfigurationTarget.Workspace);
    });

    it("creates a new profile in workspace folder settings when a multi-root workspace is open", async function () {
      stubConfiguration({ globalValue: userSetting });
      stubWorkspaceFolders(2);

      await profileConfig.upsertProfile(
        "newProfile",
        newViyaProfile("https://new-host.sas.com"),
      );

      const [, , target] = updateStub.firstCall.args;
      expect(target).to.equal(ConfigurationTarget.WorkspaceFolder);
    });

    it("creates a new profile in global settings when no workspace is open", async function () {
      stubConfiguration({});
      stubWorkspaceFolders(0);

      await profileConfig.upsertProfile(
        "newProfile",
        newViyaProfile("https://new-host.sas.com"),
      );

      const [, , target] = updateStub.firstCall.args;
      expect(target).to.equal(ConfigurationTarget.Global);
    });

    it("updates an existing user profile in global settings, even with a workspace open", async function () {
      stubConfiguration({ globalValue: userSetting });
      stubWorkspaceFolders(1);

      await profileConfig.upsertProfile(
        "userProfile",
        newViyaProfile("https://user-host-updated.sas.com"),
      );

      const [, value, target] = updateStub.firstCall.args;
      expect(target).to.equal(ConfigurationTarget.Global);
      expect(value.profiles.userProfile.endpoint).to.equal(
        "https://user-host-updated.sas.com",
      );
      expect(Object.keys(value.profiles)).to.have.members(["userProfile"]);
    });

    it("updates an existing workspace profile in workspace settings", async function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: workspaceSetting,
      });
      stubWorkspaceFolders(1);

      await profileConfig.upsertProfile(
        "workspaceProfile",
        newViyaProfile("https://workspace-host-updated.sas.com"),
      );

      const [, value, target] = updateStub.firstCall.args;
      expect(target).to.equal(ConfigurationTarget.Workspace);
      expect(value.profiles.workspaceProfile.endpoint).to.equal(
        "https://workspace-host-updated.sas.com",
      );
      expect(Object.keys(value.profiles)).to.have.members(["workspaceProfile"]);
    });

    it("updates an existing workspace folder profile in workspace folder settings", async function () {
      stubConfiguration({
        globalValue: userSetting,
        workspaceValue: workspaceSetting,
        workspaceFolderValue: workspaceFolderSetting,
      });
      stubWorkspaceFolders(2);

      await profileConfig.upsertProfile(
        "folderProfile",
        newViyaProfile("https://folder-host-updated.sas.com"),
      );

      const [, value, target] = updateStub.firstCall.args;
      expect(target).to.equal(ConfigurationTarget.WorkspaceFolder);
      expect(value.profiles.folderProfile.endpoint).to.equal(
        "https://folder-host-updated.sas.com",
      );
      expect(Object.keys(value.profiles)).to.have.members(["folderProfile"]);
    });

    it("does not copy user profiles into workspace settings when creating a new workspace profile", async function () {
      stubConfiguration({ globalValue: userSetting });
      stubWorkspaceFolders(1);

      await profileConfig.upsertProfile(
        "newProfile",
        newViyaProfile("https://new-host.sas.com"),
      );

      const [, value, target] = updateStub.firstCall.args;
      expect(target).to.equal(ConfigurationTarget.Workspace);
      expect(Object.keys(value.profiles)).to.not.include("userProfile");
    });

    it("still falls back to user profiles for resolution when workspace has no profiles", function () {
      stubConfiguration({ globalValue: userSetting });
      stubWorkspaceFolders(1);

      expect(profileConfig.getActiveProfile()).to.equal("userProfile");
      expect(Object.keys(profileConfig.getAllProfiles())).to.have.members([
        "userProfile",
      ]);
    });
  });
});
