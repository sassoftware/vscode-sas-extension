---
sidebar_position: 3
---

# SAS 9.4 (remote - IOM) Connection Profile

To use a SAS 9.4 (remote – IOM) connection type, you need to have SAS Integration Technologies Client for Windows (ITCLIENT) installed on the client machine (the same machine VS Code is installed on).

You can check the SASHOME location on your client machine to see if you already have ITCLIENT installed. For example, ITCLIENT is normally installed in the default path "C:\Program Files\SASHome\x86\Integration Technologies". If that path exists on your machine, you have ITCLIENT. ITCLIENT is automatically installed with some SAS software, such as SAS Enterprise Guide and SAS Add-in for Microsoft Office, so if you have one of those on your machine, you likely already have ITCLIENT as well.

If you do not already have ITCLIENT installed on the client machine, follow the [steps](#steps-to-install-itclient).

:::note

If you are using a SAS 9.4 (remote - IOM) connection profile, you can use SAS Grid Manager to balance your workload across multiple servers.

:::

## Profile Anatomy

A SAS 9.4 (remote – IOM) connection profile includes the following parameters:

`"connectionType": "iom"`

| Name       | Description         | Additional Notes                                            |
| ---------- | ------------------- | ----------------------------------------------------------- |
| `host`     | IOM Server Host     | Appears when hovering over the status bar.                  |
| `username` | IOM Server Username | The username to establish the IOM connection to the server. |
| `port`     | IOM Server Port     | The port of the IOM server. Default value is 8591.          |

## Steps to install ITCLIENT

You can install ITCLIENT by running your SAS 9.4 installer and making sure "Integration Technologies Client" is checked, or by visiting the following [link](https://support.sas.com/downloads/browse.htm?fil=&cat=56) to download and install it on the client machine. See the note below for guidance on which version to download and install.

**Note**: If you have no existing SAS software on the client machine, download and install the latest (currently 9.4M8) version of ITCLIENT from the link above. If you have SAS software already installed on the client machine, make sure to download and install the matching version of ITCLIENT. For example, if you already have SAS 9.4M6 on the client machine (a 9.4M6 SASHOME directory), download and install the 9.4M6 version of ITCLIENT from the link above.

ITCLIENT is backwards compatible, so any version of ITCLIENT will allow you to connect to the same or earlier version V9 SAS server. For example, if you have 9.4M8 ITCLIENT, you will be able to connect to SAS 9.4M8, 9.4M7, 9.4M6, or earlier SAS 9.4 servers. If you have 9.4M7 ITCLIENT, you will be able to connect to SAS 9.4M7, 9.4M6, or earlier SAS 9.4 servers.
