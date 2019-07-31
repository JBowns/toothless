const fs = require('fs');

const { init: initSsh } = require('../lib/ssh');
const { init: initGit, getState: getGitState } = require('../lib/git');
const { getProfile: getNpmProfile } = require('../lib/npm');
const { getProfile: getGitHubProfile, getState: getGitHubState } = require('../lib/github');
const { verifyState, verifyEnvs } = require('./verification');

const init = async ({ flags = {} } = {}, { verify = true } = {}) => {

  if (!fs.existsSync('/.dockerenv')) {
    throw Error("until this package explicitly supports a non-containerised version please don't execute it locally")
  }

  verifyEnvs([
    'NPM_ORG',
    'NPM_TOKEN',
    'GITHUB_KEY',
    'GITHUB_TOKEN',
    'GITHUB_OWNER',
    'GITHUB_REPO',
    'GITHUB_DEFAULT_BRANCH_PROTECTION_RULES',
    'GIT_RELEASE_BRANCH'
  ]);

  const {
    VERBOSE,
    NPM_ORG,
    NPM_TOKEN,
    GITHUB_KEY,
    GITHUB_PASSPHRASE,
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GIT_RELEASE_BRANCH
  } = process.env;

  const global = {
    verbose: VERBOSE === 'true'
  };

  const config = {
    github: {
      ...global,
      token: GITHUB_TOKEN,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GIT_RELEASE_BRANCH
    },
    npm: {
      ...global,
      token: NPM_TOKEN,
      org: NPM_ORG
    },
    git: {
      ...global,
      release: GIT_RELEASE_BRANCH
    },
    ssh: {
      ...global,
      priv: GITHUB_KEY,
      passphrase: GITHUB_PASSPHRASE
    }
  };

  const ssh = await initSsh(config.ssh);

  const profile = {
    github: await getGitHubProfile(config.github),
    npm: await getNpmProfile(config.npm)
  };

  await initGit(config.git, profile.github);

  const git = await getGitState(config.git)
  const github = await getGitHubState(config.github, git)
  const state = {
    flags,
    config,
    vcs: { git, github },
    ssh,
    profile
  };

  if (verify) {
    verifyState(state);
  }

  return state;
};

module.exports = {
  init
};
