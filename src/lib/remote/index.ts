/**
 * Kyro IDE - Remote Development Module
 * SSH and Docker connection management
 */

export {
  sshManager,
  dockerManager,
  remoteWorkspaceManager,
  type SSHConnectionConfig,
  type DockerContainerConfig,
  type RemoteSession,
  type RemoteFile,
  type RemoteTerminal,
} from './remote-manager';
