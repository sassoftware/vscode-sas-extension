---
sidebar_position: 2
---

# SAS 9.4 (local) Connection Profile

To use a SAS 9.4 (local) connection type, you need to install both SAS Integration Technologies Client for Windows (ITCLIENT) and the SAS Providers for OLE DB on the client machine where VS Code is installed. The order of installation does not matter.

:::note

You must install the SAS Providers for OLE DB if you are running the SAS Extension for Visual Studio Code v1.15 or later.

:::

SAS Integration Technologies Client and SAS Providers for OLE DB are automatically installed with some SAS software, such as SAS Enterprise Guide and SAS Add-in for Microsoft Office. You can check the SASHOME location on your client machine to see if SAS Integration Technologies Client and SAS Providers for OLE DB are installed in their default locations.

If the following folders exist on your machine, then the software is installed:

- SAS Integration Technologies Client - `C:\Program Files\SASHome\x86\Integration Technologies`

- SAS Providers for OLE DB - `C:\Program Files\SASHome\x86\SASProvidersforOLEDB`

If you do not already have SAS Integration Technologies Client and SAS Providers for OLE DB installed on the client machine, see [Installing SAS Integration Technologies Client and SAS Providers for OLE DB](./sas9iom.md#installing-sas-integration-technologies-client-and-sas-providers-for-ole-db).

## Profile Anatomy

A local SAS 9.4 connection profile includes the following parameters:

`"connectionType": "com"`

| Name                       | Description                      | Additional Notes                                                                                       |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `host`                     | Indicates SAS 9.4 local instance | Defaults to "localhost" for com                                                                        |
| `interopLibraryFolderPath` | COM interop library path         | A custom path to a folder containing SAS interop libraries (`SASInterop.dll` and `SASOManInterop.dll`) |
