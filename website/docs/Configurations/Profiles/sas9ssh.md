---
sidebar_position: 4
---

# SAS 9.4 (remote - SSH) Connection Profile

For a secure connection to SAS 9.4 (remote - SSH) server, a public / private SSH key pair is required. There are two ways to provide a Private Key:

1. (Preferred) The socket defined in the environment variable `SSH_AUTH_SOCK` is used to communicate with ssh-agent to authenticate the SSH session. The private key must be registered with the ssh-agent. The steps for configuring SSH follow.
1. (Non-Preferred) When creating an SSH profile, you will be asked for an identityFile. This is the full path to a private key. Note that this private key must be created without a passphrase protecting it (hence, this is the non-preferred path). Leave this blank if using ssh-agent

## Profile Anatomy

A SAS 9.4 (remote – SSH) connection profile includes the following parameters:

`"connectionType": "ssh"`

| Name           | Description                          | Additional Notes                                                           |
| -------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| `host`         | SSH Server Host                      | Appears when hovering over the status bar.                                 |
| `username`     | SSH Server Username                  | The username to establish the SSH connection to the server.                |
| `port`         | SSH Server Port                      | The SSH port of the SSH server. The default value is 22.                   |
| `saspath`      | Path to SAS Executable on the server | Must be a fully qualified path on the SSH server to a SAS executable file. |
| `identityFile` | Full path to private key             | Must be a fully qualified path on local host to an unshielded private key. |

## Required setup for connection to SAS 9.4 (remote - SSH)

In order to configure the connection between VS Code and SAS 9, you must configure OpenSSH. Follow the steps below to complete the setup.

### Windows

1. Enable OpenSSH for Windows using these [instructions](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse?tabs=gui).

2. [Create an environment variable](https://phoenixnap.com/kb/windows-set-environment-variable) named SSH_AUTH_SOCK with value `//./pipe/openssh-ssh-agent`
   (Windows uses a named pipe for the auth sock).

   **Note**: An attempt to create the varible using Powershell command line did not register; suggest using these GUI instructions.

3. Ensure that the ssh-agent service is running and set the Startup type to Automatic using [these instructions](https://dev.to/aka_anoop/how-to-enable-openssh-agent-to-access-your-github-repositories-on-windows-powershell-1ab8)

4. [Generate ed25519 keys](https://medium.com/risan/upgrade-your-ssh-key-to-ed25519-c6e8d60d3c54) with the following command (email address is not binding; you can use any email address):

```sh
ssh-keygen -o -a 100 -t ed25519 -f ~/.ssh/id_ed25519 -C "youremail@company.com"
```

5. You are prompted to enter additional information. If you did not enter a path, a default path is provided for you. You can also specify a passphrase. If you do not specify a passphrase, your key is not password-protected. Press Enter to accept the default value for each prompt.

   - Enter a file in which to save the key (/c/Users/you/.ssh/id_ed25519):[Press enter]
   - Enter passphrase (empty for no passphrase): [Type a passphrase]
   - Enter same passphrase again: [Type passphrase again]

6. Define an entry in ~/.ssh/config using the following format:

```
Host host.machine.name
    AddKeysToAgent yes
    IdentityFile /path/to/private/key/with/passphrase
```

Note: if ~/.ssh/config does not exist, run the following Powershell command to create it: `Out-File -FilePath config`

7. Add the private key to ssh-agent: ssh-add /path/to/private/key/with/passphrase

8. In VS Code, define a connection profile (see detailed instructions in the [Add New Connection Profile](./index.md#add-new-connection-profile) section). The connection for the remote server is stored in the settings.json file.

```json
"ssh_test": {
    "connectionType": "ssh",
    "host": "host.machine.name",
    "saspath": "/path/to/sas/executable",
    "username": "username",
    "port": 22
}
```

Note: the default path to the SAS executable (saspath) is /opt/sasinside/SASHome/SASFoundation/9.4/bin/sas_u8. Check with your SAS administrator for the exact path.

9. Add the public part of the keypair to the SAS server. Add the contents of the key file to the ~/.ssh/authorized_keys file. If you have it on your system, you can use "ssh-copy-id" command to make this easy. By default, ```ssh-copy-id host.machine.name``` will probably do what you need.

### Mac

1. Start ssh-agent in the background:

```sh
eval "$(ssh-agent -s)"
```

2. Ensure that SSH_AUTH_SOCK has a value

```sh
echo $SSH_AUTH_SOCK
```

3. Define an entry in $HOME/.ssh/config of the form:

```
Host host.machine.name
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile /path/to/private/key/with/passphrase
```

4. Add the private key to ssh-agent: ssh-add /path/to/private/key/with/passphrase

5. Define a connection profile in settings.json for a remote server (see detailed instructions in the [Add New Connection Profile](./index.md#add-new-connection-profile) section):

```json
"ssh_test": {
    "connectionType": "ssh",
    "host": "host.machine.name",
    "saspath": "/path/to/sas/executable",
    "username": "username",
    "port": 22
}
```

6. Add the public part of the keypair to the SAS server. Add the contents of the key file to the ~/.ssh/authorized_keys file. If you have it on your system, you can use "ssh-copy-id" command to make this easy. By default, ```ssh-copy-id host.machine.name``` will probably do what you need.

## Windows/Mac/Linux using only identityFile

1. Create a keypair and copy to the server, as described in sections above
   1. It must be created without a passphrase
1. In the profile, provide the full path to your private key:

```json
"ssh_test": {
    "connectionType": "ssh",
    "host": "host.machine.name",
    "saspath": "/path/to/sas/executable",
    "username": "username",
    "port": 22,
    "identityFile": "c:\\Users\\username\\.ssh\\id_ed25519"
}
```

