const fs = require('fs');
const git = require('simple-git/promise');

const GIT_CONFIG = '/root/.gitconfig';

const createGitConfig = (name, email) => {
  const config = ['[user]', `name = ${name}`, `email = ${email}`];
  fs.writeFileSync(GIT_CONFIG, config.join('\n'), {
    encoding: 'utf8',
    mode: '0600',
    flag: 'w'
  });
};

const push = () =>
  git()
    .silent(true)
    .push()

const pushTags = () =>
  git()
    .silent(true)
    .pushTags()

const fetch = () =>
  git()
    .silent(true)
    .fetch()

const findCommitByBranchName = async (branches, name) => {
  const [, { commit } = {}] = Object.entries(branches).find(([branch]) => branch === name) || [];
  return {
    name,
    commit: await git().revparse([commit]).then(hash => hash.replace('\n', '')),
  };
};

const currentStatus = ({ verbose }) =>
  git()
    .silent(true)
    .status()
    .then(({ ahead, behind, files, current, tracking }) => {
      return git().branch().then(async ({ branches }) => {
        const local = await findCommitByBranchName(branches, current);
        const remote = await findCommitByBranchName(branches, `remotes/${tracking}`);
        const tags = await latestTags();
        return {
          ahead,
          behind,
          changes: files.length,
          local,
          remote,
          tags
        };
      });
    })
    .catch(({ message }) => {
      if (verbose) {
        console.error(message);
      }
      throw new Error(`unable to determine repsitory status.`);
    });

const latestStatus = config => fetch(config).then(currentStatus);

const latestTags = async () => {

  const parseTags = tags => (tags || '')
  .split('\n')
  .filter(Boolean)
  .map(str => {
    const [ hash, name ] = str.split(/[\t|\s]refs\/tags\//);
    return { hash, name };
  });

  const local = await git().raw(['show-ref', '--tags']).then(parseTags);
  const remote = await git().listRemote(['--tags', '--refs']).then(parseTags);

  const tagDifference = (tagsA, tagsB) => {
    const hashes = tagsB.map(({ hash }) => hash);
    return tagsA.filter(({ hash }) => !hashes.includes(hash)).map(({ name }) => name);
  }

  return {
    local,
    remote,
    not_pushed: tagDifference(local, remote),
    not_pulled: tagDifference(remote, local)
  }
};

const getState = async config => {
  const fetched = await fetch(config).then(() => true).catch(() => false);
  const status = await currentStatus(config);
  return {
    fetched,
    ...status
  };
};

const init = async (config, github) => {
  const { name, email } = github;
  createGitConfig(name, email);
};

module.exports = {
  init,
  getState,
  latestStatus,
  push,
  pushTags
};
