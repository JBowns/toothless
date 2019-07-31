const { init } = require('../core/state');
const {
  blockRepositoryMerges,
  lernaVersion
} = require('../core/actions');

const cli = {
  command: 'version',
  options: [],
  examples: [{ name: 'version', description: 'Starts the publish process by blocking merges, and proceeds to generate the appropriate commit and tags.' }],
  flags: {}
};

const execute = async (cli) => {
  const { config } = await init(cli, { verify: true });
  await blockRepositoryMerges(config);
  await lernaVersion(config);
};

module.exports = {
  ...cli,
  execute
};
