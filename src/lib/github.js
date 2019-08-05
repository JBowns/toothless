const Octokit = require('@octokit/rest');
const _ = require('underscore');
const fs = require('fs');
const chalk = require('chalk');

const { GITHUB_PUBLISH_CONTEXT } = require('../core/constants');
const { colorise } = require('../utils/json');

const SAVED_BRANCH_PROTECTION_RULES = 'saved-branch-protection-rules.json';

const github = async ({ token, ...obj }, callback) => {
  const client = new Octokit({
    auth: `token ${token}`
  });
  const config = { ...obj, client };
  return await callback(config);
};

const saveBranchProtectionRules = branchProtectionRules => {
  if (fs.existsSync(SAVED_BRANCH_PROTECTION_RULES)) {
    console.log('saving OfflineBranchProtectionRules (Skipping)');
  } else {
    const data = JSON.stringify(branchProtectionRules, null, 2);
    console.log('saving OfflineBranchProtectionRules', colorise(branchProtectionRules));
    fs.writeFileSync(SAVED_BRANCH_PROTECTION_RULES, data);
  }
};

const deleteSavedBranchProtectionRules = () => {
  if (fs.existsSync(SAVED_BRANCH_PROTECTION_RULES)) {
    console.log('deleting OfflineBranchProtectionRules');
    fs.unlinkSync(SAVED_BRANCH_PROTECTION_RULES);
  } else {
    console.log('deleting OfflineBranchProtectionRules (Skipping)');
  }
};

const fetchSavedBranchProtectionRules = () => {
  if (fs.existsSync(SAVED_BRANCH_PROTECTION_RULES)) {
    return JSON.parse(fs.readFileSync(SAVED_BRANCH_PROTECTION_RULES));
  } else {
    throw new Error(`no backup BranchProtectionRules found.`);
  }
};

const fetchBaselineBranchProtectionRules = () => {
  const { GITHUB_DEFAULT_BRANCH_PROTECTION_RULES } = process.env;
  let rules;
  try {
    rules = JSON.parse(GITHUB_DEFAULT_BRANCH_PROTECTION_RULES);
  } catch (err) {
    console.log(err);
    throw Error(`unable to parse default branch protection rules '${GITHUB_DEFAULT_BRANCH_PROTECTION_RULES}'`);
  }
  return rules;
};

const fetchLatestBranchProtectionRules = ({ client, owner, repo, branch }) =>
  client.repos.getBranchProtection({
    owner,
    repo,
    branch,
    mediaType: {
      previews: ['luke-cage']
    }
  }).then(({ data }) => {
    const removeAttrIfKeyContains = (data, attr) => {
      Object.keys(data).forEach(key => {
        if (key.includes(attr)) {
          delete data[key];
        } else if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
          removeAttrIfKeyContains(data[key], attr);
        }
      });
    };
    removeAttrIfKeyContains(data, 'url');
    const { enforce_admins: { enabled }, ...rules } = data;
    return {
      ...rules,
      enforce_admins: enabled
    };
  });

const updateBranchProtectionRules = ({ client, owner, repo, branch }, from, to) => {

  const {
    required_status_checks = null,
    enforce_admins = null,
    required_pull_request_reviews = null,
    restrictions = null
  } = to;

  if (from.enforce_admins === enforce_admins) {
    console.log('transition ProtectedBranchAdminEnforcement (Skipping)');
  } else {
    console.log('applying ProtectedBranchAdminEnforcement', colorise(enforce_admins));
  }

  if ((from.required_status_checks.contexts.length === required_status_checks.contexts.length) && from.required_status_checks.contexts.every(e => required_status_checks.contexts.includes(e))) {
    console.log('transition RequiredStatusChecks (Skipping)');
  } else {
    console.log('applying RequiredStatusChecks', colorise(required_status_checks));
  }

  if (_.isEqual(from.required_pull_request_reviews, required_pull_request_reviews)) {
    console.log('transition RequiredApprovingReviewCount (Skipping)');
  } else {
    console.log('applying RequiredApprovingReviewCount', colorise(required_pull_request_reviews));
  }

  return client.repos.updateBranchProtection({
    owner,
    repo,
    branch,
    mediaType: {
      previews: ['luke-cage']
    },
    required_status_checks,
    enforce_admins,
    required_pull_request_reviews,
    restrictions
  });
};

const applyExtendedBranchProtection = config => {
  return github(config, async args => {

    let from = await fetchLatestBranchProtectionRules(args);
    const { required_status_checks: { contexts } } = from;

    if (contexts.includes(GITHUB_PUBLISH_CONTEXT)) {
      console.warn(chalk.yellow(`previously failed run detected, saving default branch protection rules instead`));
      saveBranchProtectionRules(fetchBaselineBranchProtectionRules());
    } else {
      saveBranchProtectionRules(from);
    }

    let to = JSON.parse(JSON.stringify(from));
    to.required_status_checks.contexts = Array.from(new Set([...contexts, GITHUB_PUBLISH_CONTEXT]));
    to.required_status_checks.strict = true;
    to.required_pull_request_reviews = null;
    to.enforce_admins = true;

    await updateBranchProtectionRules(args, from, to);

  });
};

const revertExtendedBranchProtection = config => {
  return github(config, async args => {
    const from = await fetchLatestBranchProtectionRules(args);
    const to = fetchSavedBranchProtectionRules();
    await updateBranchProtectionRules(args, from, to);
    deleteSavedBranchProtectionRules();
  })
};

const getOpenPullRequests = ({ client, owner, repo }) => {
  return client.pullRequests.list({ owner, repo, state: 'open', per_page: 100 });
};

const setCommitStatus = ({ client, owner, repo }, { number, sha, context, state, description }) => {
  const identifier = number ? `pull '#${number}' at commit '${sha}'` : `commit '${sha}'`;
  console.log(`applying '${state}' status to '${context}' context for ${identifier}`);
  return client.repos.createStatus({ owner, repo, sha, state, description, context });
};

const getPublicKeys = async (config, username) => {
  return github(config, async ({ client, ...args }) => {
    const {
      data: profileKeys = []
    } = await client.users.listPublicKeysForUser({ username });
    const {
      data: repositoryKeys = []
    } = await client.repos.listDeployKeys(args);

    return [
      ...repositoryKeys.filter(({ read_only }) => !read_only).map(({ key }) => key),
      ...profileKeys.map(({ key }) => key)
    ];
  });
};

const getRepositoryPermissions = (config, username) => {
  return github(config, ({ client, owner, repo }) => {
    return client.repos.getCollaboratorPermissionLevel({ owner, repo, username })
      .then(({ data: { permission } }) => permission);
  });
};

const applyPullRequestStatus = config => {
  return github(config, async ({ state, description, ...args }) => {
    const context = GITHUB_PUBLISH_CONTEXT;
    const { data } = await getOpenPullRequests(args);

    return Promise.all(data.map(({ number, head: { sha } }) => setCommitStatus(args, { number, sha, context, state, description })));
  });
};

const getLatestCommitStatuses = (config, ref) => {
  return github(config, async args => {
    const { client, ...options } = args;
    const { required_status_checks: { contexts = [] } = {} } = await fetchLatestBranchProtectionRules(args);
    const { data: statuses = [] } = await client.repos.listStatusesForRef({ ...options, ref });

    return contexts.filter(name => name !== GITHUB_PUBLISH_CONTEXT).map(name => {
      const { context = name, state = '' } = statuses.find(({ context }) => context === name) || {};
      return { context, state };
    });
  });
};

const overrideCommitStatus = async (config, { commit, state, description }) => {
  return github(config, async args => {
    const { required_status_checks: { contexts = [] } = {} } = await fetchLatestBranchProtectionRules(args);
    return Promise.all(contexts.map(context => setCommitStatus(args, { sha: commit, context, state, description })));
  });
};

const getProfile = async ({ github: config }) => {
  const user = await getUser(config);
  if (user) {
    const keys = await getPublicKeys(config, user.username);
    const access = await getRepositoryPermissions(config, user.username);
    const repository = { name: config.repo, access };
    return {
      ...user,
      repository,
      keys
    };
  }
  return undefined;
};

const getUser = async config => {
  return github(config, ({ client }) =>
    client.users.getAuthenticated()
      .then(({
        data: {
          login: username,
          name,
          email
        } = {}
      }) => ({ username, name, email }))
      .catch(err => {
        console.error(err);
        return null;
      })
  );
};

const getState = async ({ github: config }, git) => {
  const { remote: { commit } } = git;
  return {
    commit,
    statuses: await getLatestCommitStatuses(config, commit),
    branch_protection: {
      remote: await github(config, args => fetchLatestBranchProtectionRules(args)),
      baseline: fetchBaselineBranchProtectionRules()
    }
  };
};

module.exports = {
  applyExtendedBranchProtection,
  revertExtendedBranchProtection,
  applyPullRequestStatus,
  overrideCommitStatus,
  getProfile,
  getState
};
