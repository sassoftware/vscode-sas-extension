import { l10n, window } from "vscode";

import { getSecretStorage } from "../../components/ExtensionContext";

const SECRET_STORAGE_NAMESPACE = "ITC_SECRET_STORAGE";

class PasswordStore {
  protected password: string;
  protected secretStorage;
  protected passwordKey: string;
  protected emptyPasswordAllowed: boolean;

  public set allowEmptyPassword(value: boolean) {
    this.emptyPasswordAllowed = value;
  }

  constructor() {
    this.password = "";
    this.secretStorage = getSecretStorage(SECRET_STORAGE_NAMESPACE);
    this.emptyPasswordAllowed = false;
  }

  public updatePasswordKey(passwordKey: string): void {
    this.passwordKey = passwordKey;
  }

  public async clearPassword(): Promise<void> {
    await this.secretStorage.store(this.passwordKey, "");
    this.password = "";
  }

  public async persistPassword(): Promise<void> {
    await this.secretStorage.store(this.passwordKey, this.password);
  }

  public async fetchPassword(): Promise<string> {
    if (this.emptyPasswordAllowed) {
      return "";
    }

    const storedPassword = await this.secretStorage.get(this.passwordKey);
    if (storedPassword) {
      this.password = storedPassword;
      return storedPassword;
    }

    this.password =
      (await window.showInputBox({
        ignoreFocusOut: true,
        password: true,
        prompt: l10n.t("Enter your password for this connection."),
        title: l10n.t("Enter your password"),
      })) || "";

    return this.password;
  }
}

export default PasswordStore;
