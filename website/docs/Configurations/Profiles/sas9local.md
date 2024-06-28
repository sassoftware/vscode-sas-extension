---
sidebar_position: 2
---

# SAS 9.4 (local) Connection Profile

To use a SAS 9.4 (local) connection type, you need to have SAS Integration Technologies Client for Windows (ITCLIENT) installed on the client machine (the same machine VS Code is installed on).

You can check the SASHOME location on your client machine to see if you already have ITCLIENT installed. For example, ITCLIENT is normally installed in the default path "C:\Program Files\SASHome\x86\Integration Technologies". If that path exists on your machine, you have ITCLIENT. ITCLIENT is automatically installed with some SAS software, such as SAS Enterprise Guide and SAS Add-in for Microsoft Office, so if you have one of those on your machine, you likely already have ITCLIENT as well.

If you do not already have ITCLIENT installed on the client machine, follow the [steps](./sas9iom.md#steps-to-install-itclient).

## Profile Anatomy

A local SAS 9.4 connection profile includes the following parameters:

`"connectionType": "com"`

| Name   | Description                      | Additional Notes                |
| ------ | -------------------------------- | ------------------------------- |
| `host` | Indicates SAS 9.4 local instance | Defaults to "localhost" for com |
