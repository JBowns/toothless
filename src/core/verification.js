const _ = require('underscore');
const chalk = require('chalk');

const {
  NPM_ORG_MEMBER,
  NPM_ORG_ADMIN,
  NPM_ORG_OWNER,
  NPM_2FA_AUTH_ONLY,
  NPM_2FA_AUTH_AND_WRITES,
  GITHUB_COMMIT_STATUS_SUCCESS,
  GITHUB_COLLABORATOR_ADMIN,
  GITHUB_PUBLISH_CONTEXT
} = require('./constants');

const verifyEnvs = envs => {
  envs.forEach(name => {
    if (!process.env[name]) {
      throw new Error(`please supply the '${name}' via environment variable`);
    }
  });
};

const verifyState = state => {
  [
    verifyNpmProfile,
    verifyGitHubProfile,
    verifyReleaseBranch,
    verifyNoWorkingChanges,
    verifySSHKeyCanFetch,
    verifyBranchIsntAhead,
    verifyBranchIsntBehind,
    verifyBranchMatchesRemote,
    verifyLocalTagsMatchRemote,
    verifyRemoteTagsMatchLocal,
    verifyRequiredStatusChecksForLatestBranchCommit,
    verifySSHKeyOwnership,
    verifyGitHubRepositoryAdminPrivileges,
    verifyGitHubDefaultBranchProtectionRulesMatchRemote,
    verifyNpmTokenPublishConfiguration,
    verifyNpmAccount2FAConfiguration,
    verifyNpmAccountOrgPrivileges
  ].forEach(verify => verify(state));
  return state;
};

const verifyNpmProfile = ({ config: { flags: { skipNpmVerification } }, profile: { npm } }) => {
  console.log('verifying npm profile returned successfully.');
  if (skipNpmVerification) {
    console.warn(chalk.yellow('skipping npm profile verification.'));
  } else {
    if (!npm) {
      throw new Error('unable to fetch NPM profile, please ensure your token is valid.');
    }
  }
};

const verifyGitHubProfile = ({ profile: { github } }) => {
  console.log('verifying GitHub profile returned successfully.');
  if (!github) {
    throw new Error('unable to fetch GitHub profile, please ensure your token is valid.');
  }
};

const verifyReleaseBranch = ({ config: { git: { release } }, vcs: { git: { local: { name } } } }) => {
  console.log(`verifying '${name}' matches specified release branch '${release}'.`);
  if (!release || !name || release !== name) {
    throw new Error(`the currently checked out branch '${name}' doesn't match the provided release branch '${release}'`);
  }
};

const verifyNoWorkingChanges = ({ vcs: { git: { changes } } }) => {
  console.log('verifying release branch doesn\'t contain any working changes.');
  if (changes > 0) {
    throw new Error('your release branch contains working changes.');
  }
};

const verifySSHKeyOwnership = ({ profile: { github: { keys } }, ssh: { pub } }) => {
  console.log('verifying GitHub ssh keys match at least one ssh-agent identity.');
  if (!keys.some(key => key === pub)) {
    throw new Error(`your SSH key isn't associated to the GitHub account you've provided, this makes it impossible to determine the keys push privileges.`);
  }
};

const verifySSHKeyCanFetch = ({ vcs: { git: { fetched } } }) => {
  console.log('verifying ssh key is capable of fetching remote changes.');
  if (!fetched) {
    throw new Error(`your SSH key couldn't fetch the latest repository updates, this could be due to your organisations SSO configuration.`);
  }
};

const verifyBranchMatchesRemote = ({ vcs: { git: { local: { name: localName, commit: localCommit }, remote: { name: remoteName, commit: remoteCommit } } } }) => {
  console.log(`verifying local '${localCommit}' release branch is up to date with remote '${remoteCommit}'.`);
  if (!localCommit || !remoteCommit || localCommit !== remoteCommit) {
    throw new Error(`the release branch '${localName}@${localCommit}' is not up to date with '${remoteName}@${remoteCommit}'.`);
  }
};

const verifyBranchIsntAhead = ({ vcs: { git: { ahead } } }) => {
  console.log(`verifying release branch isn't ahead of remote.`);
  if (ahead > 0) {
    throw new Error(`the release branch is ahead of remote by ${ahead} ${ahead === 1 ? 'commit' : 'commits'}.`);
  }
};

const verifyBranchIsntBehind = ({ vcs: { git: { behind } } }) => {
  console.log(`verifying release branch isn't behind remote.`);
  if (behind > 0) {
    throw new Error(`the release branch is behind remote by ${behind} ${behind === 1 ? 'commit' : 'commits'}.`);
  }
};

const verifyRequiredStatusChecksForLatestBranchCommit = ({ vcs: { github: { commit, statuses } } }) => {
  console.log(`verifying latest release branch commit has passed GitHub status checks '${JSON.stringify(statuses)}'.`);
  statuses.forEach(({ context, state }) => {
    if (state !== GITHUB_COMMIT_STATUS_SUCCESS) {
      throw new Error(`the latest branch commit '${commit}' has failed status check '${context}' with state '${state}'.`);
    }
  });
};

const verifyLocalTagsMatchRemote = ({ vcs: { git: { tags: { not_pushed } } } }) => {
  console.log('verifying all local tags have been pushed.');
  if (not_pushed.length > 0) {
    throw new Error(`please ensure that your local tags have been pushed or removed prior to publish '${JSON.stringify(not_pushed)}'.`);
  }
};

const verifyRemoteTagsMatchLocal = ({ vcs: { git: { tags: { not_pulled } } } }) => {
  console.log('verifying all local tags match the remote.');
  if (not_pulled.length > 0) {
    throw new Error(`there is a mismatch between your remote and local tags '${JSON.stringify(not_pulled)}'.`);
  }
};

const verifyGitHubRepositoryAdminPrivileges = ({ profile: { github: { repository: { name, access } } } }) => {
  console.log(`verifying GitHub token has administrative privileges for '${name}'.`);
  if (access !== GITHUB_COLLABORATOR_ADMIN) {
    throw new Error(`the GitHub account you've provided doesn't have administrative privileges to '${name}'`);
  }
};

const verifyGitHubDefaultBranchProtectionRulesMatchRemote = ({ vcs: { github: { branch_protection: { baseline, remote } } } }) => {
  const message = `GitHub default branch protection rules match the remote.`;
  if (!remote.required_status_checks.contexts.includes(GITHUB_PUBLISH_CONTEXT)) {
    console.log(`verifying ${message}`);
    if (!_.isEqual(baseline, remote)) {
      throw new Error(`the default '${JSON.stringify(baseline)}' branch protection rules do not match the remote '${JSON.stringify(remote)}'`);
    }
  } else {
    console.log(`ignoring ${message}`);
  }
};

const verifyNpmTokenPublishConfiguration = ({ config: { flags: { skipNpmVerification } }, profile: { npm: { auth: { readonly } = {} } = {} } }) => {
  console.log('verifying npm token has appropriate permissions to publish.');
  if (skipNpmVerification) {
    console.warn(chalk.yellow('skipping npm profile verification.'));
  } else {
    if (readonly === true) {
      throw new Error(`the NPM token you have provided is read-only and therefore unable to publish.`);
    }
  }
};

const verifyNpmAccount2FAConfiguration = ({ config: { flags: { skipNpmVerification } }, profile: { npm: { tfa: { mode } = {} } = {} } }) => {
  console.log('verifying npm profile has appropriate 2FA permissions.');
  if (skipNpmVerification) {
    console.warn(chalk.yellow('skipping npm profile verification.'));
  } else {
    if (mode === NPM_2FA_AUTH_AND_WRITES) {
      throw new Error(`the NPM accounts 2FA configuration is too restrictive for this automated process, please use '${NPM_2FA_AUTH_ONLY}' instead of '${NPM_2FA_AUTH_AND_WRITES}'`);
    }
  }
};

const verifyNpmAccountOrgPrivileges = ({ config: { flags: { skipNpmVerification } }, profile: { npm: { organisation: { access } = {} } = {} } }) => {
  console.log('verifying npm profile has appropriate permissions to publish.');
  if (skipNpmVerification) {
    console.warn(chalk.yellow('skipping npm profile verification.'));
  } else {
    if (![NPM_ORG_MEMBER, NPM_ORG_ADMIN, NPM_ORG_OWNER].some(type => type === access)) {
      throw new Error(`the NPM account doesn't have the appropriate permissions to publish`);
    }
  }
};

module.exports = {
  verifyState,
  verifyEnvs,
  verifyBranchMatchesRemote
};
