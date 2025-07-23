---
sidebar_position: 1
---

# SAS Viya Connection Profile

## Profile Anatomy

A SAS Viya connection profile includes the following parameters:

`"connectionType": "rest"`

| Name           | Description                                                           | Additional Notes                                                                                                                                           |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `endpoint`     | URL for the SAS Viya server. An example is `https://example.sas.com`. | Appears when hovering over the status bar.                                                                                                                 |
| `context`      | Context for Compute Server                                            | Please see [SAS Documentation](https://go.documentation.sas.com/doc/en/sasadmincdc/default/evfun/p1dkdadd9rkbmdn1fpv562l2p5vy.htm) for more information.   |
| `clientId`     | Registered Client ID for SAS Viya                                     | Please contact your SAS administrator. `authorization_code` and `refresh_token` grant types are required.<br /> _Leave blank for Viya4 2022.11 and later._ |
| `clientSecret` | Registered Client Secret for SAS Viya                                 | Please contact your SAS administrator.<br /> _Leave blank for Viya4 2022.11 and later._                                                                    |

Depending on your SAS Viya version, the values for the prompts differ slightly.

- For SAS Viya 2022.11 and later, you can leave Client ID and Client Secret prompts empty and simply press Enter. (The built-in Client ID `vscode` will be used.)

- For SAS Viya 2022.10 and before (including SAS Viya 3.5), you need to provide a Client ID and secret.

For more information about Client IDs and the authentication process, please see the blog post [Authentication to SAS Viya: a couple of approaches](https://blogs.sas.com/content/sgf/2021/09/24/authentication-to-sas-viya/). A SAS administrator can follow the Steps 1 and 2 in the post to register a new client.
