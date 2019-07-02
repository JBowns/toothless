const fs = require('fs');
const NpmRegistyClient = require('npm-registry-client');
const axios = require('axios');

const NPM_REGISTRY = 'registry.npmjs.org';
const NPM_RC = '.npmrc';

const applyPublishToken = ({ token }) => {
  fs.writeFileSync(NPM_RC, `//${NPM_REGISTRY}/:_authToken=${token}\n`, {
    encoding: 'utf8',
    mode: '0600',
    flag: 'w'
  });
};

const revertPublishToken = () => {
  fs.unlinkSync(NPM_RC);
};

const getProfile = async config => {
  const user = await getUser(config);
  if (user) {
    const tokens = await getTokens(config);
    const access = await getOrganisationPermissions(config, user.username);
    const organisation = { name: config.org, access };
    const shard = config.token.substr(0, 6);
    return {
      ...user,
      organisation,
      auth: tokens.find(({ token }) => token === shard) || {}
    };
  }
  return null;
};

const getUser = ({ verbose, token }) =>
  axios.get(`https://${NPM_REGISTRY}/-/npm/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(({ data: {
    name: username,
    fullname: name,
    email,
    tfa
  } = {} }) =>
    ({ username, name, email, tfa }))
  .catch(err => {
    if (verbose) {
      console.error(err);
    }
    return null;
  });

const getTokens = ({ token }) =>
  axios.get(`https://${NPM_REGISTRY}/-/npm/v1/tokens`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }).then(({ data: { objects: tokens = [] } }) => tokens.map(({ token, readonly }) => ({ token, readonly })));

const getOrganisationPermissions = async (config, username) => {
  const members = await getOrganisationMembers(config);
  const [, access = null] = Object.entries(members).find(([name]) => name === username) || [];
  return access;
};

const getOrganisationMembers = ({ token, org }) =>
  new Promise((resolve, reject) => {
    const client = new NpmRegistyClient({});
    client.org('ls', `https://${NPM_REGISTRY}`, {
      auth: { token },
      org
    },
      (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      }
    );
  });

module.exports = {
  getProfile,
  applyPublishToken,
  revertPublishToken
};
