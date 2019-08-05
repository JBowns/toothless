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
    'NPM_REGISTRY',
    'NPM_TOKEN',
    'GITHUB_KEY',
    'GITHUB_TOKEN',
    'GITHUB_OWNER',
    'GITHUB_REPO',
    'GITHUB_DEFAULT_BRANCH_PROTECTION_RULES',
    'GIT_RELEASE_BRANCH'
  ]);

  const {
    NPM_ORG,
    NPM_REGISTRY,
    NPM_TOKEN,
    GITHUB_KEY,
    GITHUB_PASSPHRASE,
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GIT_RELEASE_BRANCH
  } = process.env;

  const config = {
    flags,
    github: {
      token: GITHUB_TOKEN,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GIT_RELEASE_BRANCH
    },
    npm: {
      token: NPM_TOKEN,
      org: NPM_ORG,
      registry: NPM_REGISTRY
    },
    git: {
      release: GIT_RELEASE_BRANCH
    },
    ssh: {
      priv: GITHUB_KEY,
      passphrase: GITHUB_PASSPHRASE
    }
  };

  const ssh = await initSsh(config);

  const profile = {
    github: await getGitHubProfile(config),
    npm: await getNpmProfile(config)
  };  

  await initGit(config.git, profile.github);

  const git = await getGitState(config)
  const github = await getGitHubState(config, git)
  const state = {
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
