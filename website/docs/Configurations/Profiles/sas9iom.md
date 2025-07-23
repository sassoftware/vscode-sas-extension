---
sidebar_position: 3
---

# SAS 9.4 (remote - IOM) Connection Profile

To use a SAS 9.4 (remote – IOM) connection type, you need to install both SAS Integration Technologies Client for Windows (ITCLIENT) and the SAS Providers for OLE DB on the client machine where VS Code is installed. The order of installation does not matter.

:::note

You must install the SAS Providers for OLE DB if you are running the SAS Extension for Visual Studio Code v1.15 or later.

:::

SAS Integration Technologies Client and SAS Providers for OLE DB are automatically installed with some SAS software, such as SAS Enterprise Guide and SAS Add-in for Microsoft Office. You can check the SASHOME location on your client machine to see if SAS Integration Technologies Client and SAS Providers for OLE DB are installed in their default locations.

If the following folders exist on your machine, then the software is installed:

- SAS Integration Technologies Client - `C:\Program Files\SASHome\x86\Integration Technologies`

- SAS Providers for OLE DB - `C:\Program Files\SASHome\x86\SASProvidersforOLEDB`

If you do not already have SAS Integration Technologies Client and SAS Providers for OLE DB installed on the client machine, see [Installing SAS Integration Technologies Client and SAS Providers for OLE DB](#installing-sas-integration-technologies-client-and-sas-providers-for-ole-db).

:::note

If you are using a SAS 9.4 (remote - IOM) connection profile, you can use SAS Grid Manager to balance your workload across multiple servers.

:::

## Profile Anatomy

A SAS 9.4 (remote – IOM) connection profile includes the following parameters:

`"connectionType": "iom"`

| Name                       | Description              | Additional Notes                                                                                       |
| -------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `host`                     | IOM Server Host          | Appears when hovering over the status bar.                                                             |
| `username`                 | IOM Server Username      | The username to establish the IOM connection to the server.                                            |
| `port`                     | IOM Server Port          | The port of the IOM server. Default value is 8591.                                                     |
| `interopLibraryFolderPath` | IOM interop library path | A custom path to a folder containing SAS interop libraries (`SASInterop.dll` and `SASOManInterop.dll`) |

## Installing SAS Integration Technologies Client and SAS Providers for OLE DB

You can install SAS Integration Technologies Client and SAS Providers for OLE DB by running your SAS 9.4 installer and making sure "Integration Technologies Client" and "SAS Providers for OLE DB" are checked.

You can also use the following link to download and install the SAS Providers for OLE DB on the client machine. By default, the SAS Providers for OLE DB installation includes the SAS Integration Technologies Client. See the note below for guidance on which version to download and install.

[SAS Support Downloads: SAS Providers for OLE DB](https://support.sas.com/downloads/browse.htm?fil=&cat=64)

**Note**: If you have no existing SAS software on the client machine, download and install the latest (currently 9.4M9) version of SAS Providers for OLE DB and SAS Integration Technologies Client by using the link above. If you have SAS software already installed on the client machine, you must download and install the matching version of SAS Providers for OLE DB and SAS Integration Technologies Client. For example, if you already have SAS 9.4M6 on the client machine (a 9.4M6 SASHOME directory), download and install the 9.4M6 versions of SAS Providers for OLE DB and SAS Integration Technologies Client.

SAS Integration Technologies Client is backwards compatible, so any version of SAS Integration Technologies Client will allow you to connect to the same or earlier version SAS 9 server. For example, if you have SAS Integration Technologies Client 9.4M8, you will be able to connect to SAS 9.4M8, 9.4M7, 9.4M6, or earlier SAS 9.4 servers.
