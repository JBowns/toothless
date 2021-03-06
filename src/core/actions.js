const execa = require('execa');
const fs = require('fs');

const {
  applyPullRequestStatus,
  applyExtendedBranchProtection,
  revertExtendedBranchProtection,
  overrideCommitStatus
} = require('../lib/github');
const {
  latestStatus,
  push,
  pushTags
} = require('../lib/git');
const {
  applyPublishToken,
  revertPublishToken
} = require('../lib/npm');
const { verifyBranchMatchesRemote } = require('./verification');
const {
  GITHUB_COMMIT_STATUS_PENDING,
  GITHUB_COMMIT_STATUS_SUCCESS,
  GITHUB_COMMIT_STATUS_ERROR
} = require('./constants');

const PUBLISH_PENDING_MSG = 'Publish in progress';
const PUBLISH_FINISHED_MSG = 'Publish complete';
const PUBLISH_STOPPED_MSG = 'Publish rolled back';
const PUBLISH_ERROR_MSG = 'Publish encountered an error';
const PUSH_ERROR_MSG = 'Push encountered an error';

const COMMAND_TIMEOUT = 60000;

const LERNA_PUBLISHED_PACKAGES_REGEX = /^ - (.*)@([\d\\.?]*)$/mg;

const blockRepositoryMerge = async (github, state, description) => {
  await applyExtendedBranchProtection(github);
  await applyPullRequestStatus({ ...github, state, description });
};

const unblockRepositoryMerge = async (github, state, description) => {
  await applyPullRequestStatus({ ...github, state, description });
  await revertExtendedBranchProtection(github);
};

const verifyRepositoryState = async git => {
  const status = await latestStatus(git);
  verifyBranchMatchesRemote({ vcs: { git: { ...status } } });
};

const approvePublishCommit = async (git, github) => {
  const { local: { name: description, commit } } = await latestStatus(git);
  return overrideCommitStatus(github, { commit, description, state: GITHUB_COMMIT_STATUS_SUCCESS });
};

const extractPublishedPackages = (result) => {
  let packages = [];
  let match = null;
  const { stdout } = result;
  const regex = new RegExp(LERNA_PUBLISHED_PACKAGES_REGEX, "mg")
  
  while ((match = regex.exec(stdout)) !== null) {
    const [, name, version] = match;
    packages.push({ name, version });
  }
  fs.writeFileSync('published-packages.json', JSON.stringify(packages, null, 2));

  return result;
};

const handleProcess = (result) => {
  const { code, timedOut, killed, failed, stdout, stderr, signal, cmd } = result;
  console.log(stdout);
  console.log(stderr);
  if (code > 0 || timedOut === true || killed === true || failed === true) {
    throw new Error(`command failed '${cmd}' with ${JSON.stringify({ code, timedOut, killed, failed, signal })}`);
  }
  return result;
};

const blockRepositoryMerges = async ({ github, git, npm }) => {
  try {
    await blockRepositoryMerge(github, GITHUB_COMMIT_STATUS_PENDING, PUBLISH_PENDING_MSG);
    await verifyRepositoryState(git);
    await applyPublishToken(npm);
  } catch (err) {
    console.error(err);
    await unblockRepositoryMerge(github, GITHUB_COMMIT_STATUS_SUCCESS, PUBLISH_STOPPED_MSG);
    throw err;
  }
};

const lernaVersion = async ({ github }) => {
  try {
    console.log('lerna version...');
    await execa('lerna', ['version', '--no-push', '--yes', '--no-commit-hooks'], {
      timeout: COMMAND_TIMEOUT
    }).then(handleProcess).catch(handleProcess);
  } catch (err) {
    console.error(err);
    await unblockRepositoryMerge(github, GITHUB_COMMIT_STATUS_SUCCESS, PUBLISH_STOPPED_MSG);
    throw err;
  }
};

const lernaPublish = async ({ github }) => {
  try {
    console.log('lerna publish...');
    await execa('lerna', ['publish', 'from-package', '--yes'], {
      timeout: COMMAND_TIMEOUT
    })
      .then(handleProcess)
      .then(extractPublishedPackages)
      .catch(handleProcess);
  } catch (err) {
    console.error(err);
    await applyPullRequestStatus({ ...github, state: GITHUB_COMMIT_STATUS_ERROR, description: PUBLISH_ERROR_MSG });
    throw err;
  }
};

const pushPublish = async ({ github, git }) => {
  try {
    console.log('pushing commit...');
    await push(git).catch(async () => {
      await approvePublishCommit(git, github);
      await push(git);
    });
    console.log('pushing tags...');
    await pushTags(git);
  } catch (err) {
    console.error(err);
    await applyPullRequestStatus({ ...github, state: GITHUB_COMMIT_STATUS_ERROR, description: PUSH_ERROR_MSG });
    throw err;
  }
};

const unblockRepositoryMerges = async ({ github, npm }) => {
  await revertPublishToken(npm);
  await unblockRepositoryMerge(github, GITHUB_COMMIT_STATUS_SUCCESS, PUBLISH_FINISHED_MSG);
};

module.exports = {
  blockRepositoryMerges,
  unblockRepositoryMerges,
  lernaVersion,
  lernaPublish,
  pushPublish
};
