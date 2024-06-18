---
sidebar_position: 5
---

# SAS 9.4 (SASPy) Connection Profile

To use SAS 9.4 (SASPy) connection type, you need to have Python and [SASPy](https://sassoftware.github.io/saspy) installed locally (the machine VS Code is installed on) or remotely (if you are using VScode remote development). SASPy fully supports connection methods of STDIO (Unix only), SSH, IOM (Remote and Local) and HTTP, and partially supports connection method of COM. You can visit the following [link](https://sassoftware.github.io/saspy) to find out how to install SASPy and how to configure it.


## Profile Anatomy

A SAS 9.4 (SASPy) connection profile includes the following parameters:

`"connectionType": "saspy"`

| Name           | Description    | Additional Notes                                                              |
| -------------- | -------------- | ----------------------------------------------------------------------------- |
| `pythonpath`   | Path to python | Defaults to `python`                                                          |
| `cfgname`      | sascfg name    | Visit [link](sassoftware.github.io/saspy/configuration.html) for introduction |

