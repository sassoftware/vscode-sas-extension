import { l10n } from "vscode";

export const humanReadableMessages = [
  {
    pattern: /Setup error: AuthLockout/,
    error: l10n.t(
      "The referenced account is currently locked out and may not be logged on to.",
    ),
  },
  {
    pattern: /Setup error: AuthError/,
    error: l10n.t("The user name or password is incorrect."),
  },
  {
    pattern: /Setup error: BadHost/,
    error: l10n.t("The machine name could not be resolved to an IP address."),
  },
  {
    pattern: /Setup error: ConnectionError/,
    error: l10n.t(
      "Could not establish a connection to the server on the requested machine.  Verify that the server has been started and that the host and port of the server match your profile information.",
    ),
  },
  {
    pattern: /Run error: TranscodingFailed/,
    error: l10n.t("Run error: Some code points did not transcode."),
  },
];
