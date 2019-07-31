const Octokit = require('@octokit/rest');
const fs = require('fs');

const { GITHUB_PUBLISH_CONTEXT } = require('../core/constants');

const SAVED_BRANCH_PROTECTION_RULES = 'saved-branch-protection-rules.json';

const github = ({ token, ...obj }, callback) => {
  const client = new Octokit({
    auth: `token ${token}`
  });
  const config = { ...obj, client };
  return new Promise((resolve, reject) => {
    try {
      resolve(callback(config));
    } catch (err) {
      reject(err);
    }
  });
};

const saveBranchProtectionRules = branchProtectionRules => {
  if (fs.existsSync(SAVED_BRANCH_PROTECTION_RULES)) {
    console.log('saving OfflineBranchProtectionRules (Skipping)');
  } else {
    const data = JSON.stringify(branchProtectionRules, null, 2);
    console.log('saving OfflineBranchProtectionRules', data);
    fs.writeFileSync(SAVED_BRANCH_PROTECTION_RULES, data);
  }
};

const deleteSavedBranchProtectionRules = () => {
  if (fs.existsSync(SAVED_BRANCH_PROTECTION_RULES)) {
    console.log('Deleting OfflineBranchProtectionRules');
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
  const { RequiredStatusChecks = null, AdminEnforcement = null } = rules;
  if (RequiredStatusChecks === null) {
    throw Error(`please supply the default required status check  '${JSON.stringify({ RequiredStatusChecks: [] })}'`);
  }
  if (AdminEnforcement === null) {
    throw Error(`please supply the default admin enforcement rule '${JSON.stringify({ AdminEnforcement: false })}'`);
  }
  return rules;
}

const fetchLatestBranchProtectionRules = ({ client, owner, repo, branch }) =>
  Promise.all([
    client.repos.getProtectedBranchAdminEnforcement({ owner, repo, branch }),
    client.repos.listProtectedBranchRequiredStatusChecksContexts({ owner, repo, branch })
  ]).then(([{ data: { enabled } }, { data }]) => ({
    AdminEnforcement: enabled,
    RequiredStatusChecks: data
  }));

const transitionAdminEnforcement = async (
  { client, owner, repo, branch },
  { AdminEnforcement: from },
  { AdminEnforcement: to }
) => {
  if (from !== to) {
    console.log('applying ProtectedBranchAdminEnforcement', to);
    if (to) {
      await client.repos.addProtectedBranchAdminEnforcement({ owner, repo, branch });
    } else {
      await client.repos.removeProtectedBranchAdminEnforcement({ owner, repo, branch });
    }
  } else {
    console.log('transition ProtectedBranchAdminEnforcement (Skipping)');
  }
};

const transitionRequiredStatusChecks = async (
  { client, owner, repo, branch },
  { RequiredStatusChecks: from },
  { RequiredStatusChecks: to }
) => {
  if ((from.length === to.length) & from.every(e => to.includes(e))) {
    console.log('transition RequiredStatusChecks (Skipping)');
  } else {
    const strict = true;
    const contexts = to;
    console.log('applying RequiredStatusChecks', contexts);
    await client.repos.updateProtectedBranchRequiredStatusChecks({
      owner,
      repo,
      branch,
      contexts,
      strict
    });
  }
};

const getOpenPullRequests = ({ client, owner, repo }) => {
  return client.pullRequests.list({ owner, repo, state: 'open', per_page: 100 });
};

const setCommitStatus = ({ client, owner, repo }, { sha, context, state, description }) => {
  console.log(`Applying '${state}' status check to commit '${sha}'`);
  return client.repos.createStatus({ owner, repo, sha, state, description, context });
};

const getUser = async config => {
  return github(config, async ({ verbose, client }) =>
    client.users.getAuthenticated()
      .then(({
        data: {
          login: username,
          name,
          email
        } = {}
      }) => ({ username, name, email }))
      .catch(err => {
        if (verbose) {
          console.error(err);
        }
        return null;
      })
  );
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

const getProfile = async config => {
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

const applyExtendedBranchProtection = config => {
  return github(config, async args => {
    const from = await fetchLatestBranchProtectionRules(args);
    if (from.RequiredStatusChecks.includes(GITHUB_PUBLISH_CONTEXT)) {
      console.warn(`previously failed run detected, saving default branch protection rules instead`);
      saveBranchProtectionRules(fetchBaselineBranchProtectionRules());
    } else {
      saveBranchProtectionRules(from);
    }
    await transitionRequiredStatusChecks(args, from, {
      RequiredStatusChecks: Array.from(new Set([...from.RequiredStatusChecks, GITHUB_PUBLISH_CONTEXT]))
    });
    await transitionAdminEnforcement(args, from, {
      AdminEnforcement: true
    });
  });
};

const revertExtendedBranchProtection = config => {
  return github(config, async args => {
    const from = await fetchLatestBranchProtectionRules(args);
    const to = fetchSavedBranchProtectionRules();
    await transitionAdminEnforcement(args, from, to);
    await transitionRequiredStatusChecks(args, from, to);
    deleteSavedBranchProtectionRules();
  })
};

const applyPullRequestStatus = config => {
  return github(config, async ({ state, description, ...args }) => {
    const context = GITHUB_PUBLISH_CONTEXT;
    const { data } = await getOpenPullRequests(args);
    return Promise.all(data.map(({ head: { sha } }) => setCommitStatus(args, { sha, context, state, description })));
  });
};

const getLatestCommitStatuses = (config, ref) => {
  return github(config, async args => {
    const { client, ...options } = args;
    const { RequiredStatusChecks: checks = [] } = await fetchLatestBranchProtectionRules(args);
    const { data: statuses = [] } = await client.repos.listStatusesForRef({ ...options, ref });

    return checks.filter(name => name !== GITHUB_PUBLISH_CONTEXT).map(name => {
      const { context = name, state = '' } = statuses.find(({ context }) => context === name) || {};
      return { context, state };
    });
  });
};

const overrideCommitStatus = async (config, { commit, state, description }) => {
  return github(config, async args => {
    const { RequiredStatusChecks: checks = [] } = await fetchLatestBranchProtectionRules(args);
    return Promise.all(checks.map(context => setCommitStatus(args, { sha: commit, context, state, description })));
  });
};

const getState = async (config, git) => {
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
