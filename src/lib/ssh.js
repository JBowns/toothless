const fs = require('fs');
const execa = require('execa');

const SSH_DIR = '/root/.ssh';
const PRIVATE_KEY = `${SSH_DIR}/github_rsa`;

const createSshDirectory = () => {
  if (!fs.existsSync(SSH_DIR)) {
    fs.mkdirSync(SSH_DIR);
  }
};

const createSshKey = key => {
  fs.writeFileSync(PRIVATE_KEY, key.replace(/\\n/gm, '\n'), {
    encoding: 'utf8',
    mode: '0600',
    flag: 'w'
  });
};

const createSshConfig = ({ SSH_AUTH_SOCK }) => {
  fs.writeFileSync(`${SSH_DIR}/config`, [
    'StrictHostKeyChecking no',
    `IdentityAgent ${SSH_AUTH_SOCK}`
  ].join('\n'));
};

const startAgent = () => {
  return execa.shell('ssh-agent -s').then(({ stdout }) => extractAgentPIDAndSocket(stdout));
};

const addIdentity = (env, input) => {
  return execa.shell(`ssh-add ${PRIVATE_KEY}`, { env, input }).then(({ stderr }) => extractKeyName(stderr));
};

const getIdentity = (env, name) => {
  return execa.shell(`ssh-add -L`, { env }).then(({ stdout }) => {
    const key = stdout.split('\n').find(pub => pub.endsWith(name))
    if (key) {
      return key.substr(0, key.indexOf('==') + 2)
    }
    return key;
  });
};

const extractKeyName = out => {
  const re = new RegExp(`${PRIVATE_KEY} \\((.+)\\)`, 'gms');
  const [, name] = re.exec(out);
  return name;
};

const extractAgentPIDAndSocket = out => {
  const re = new RegExp('(?:SSH_AUTH_SOCK|SSH_AGENT_PID)=([^;]*)', 'gms');
  const [, sock] = re.exec(out);
  const [, pid] = re.exec(out);
  return {
    SSH_AUTH_SOCK: sock,
    SSH_AGENT_PID: pid
  };
};

const init = async config => {
  const { priv, passphrase } = config;
  const envs = await startAgent();
  
  createSshDirectory();
  createSshConfig(envs);
  createSshKey(priv);

  const name = await addIdentity(envs, passphrase);
  const pub = await getIdentity(envs, name);

  return { name, pub, envs };
};

module.exports = {
  init
};
