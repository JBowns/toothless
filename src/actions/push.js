const { init } = require('../core/state');
const {
  unblockRepositoryMerges,
  pushPublish
} = require('../core/actions');

const cli = {
  command: 'push',
  options: [],
  examples: [{ name: 'push', description: '   Pushes the relevant publish commit and tags to GitHub and then unblocks merging.' }],
  flags: {}
};

const execute = async (cli) => {
  const { config } = await init(cli, { verify: false });
  await pushPublish(config);
  await unblockRepositoryMerges(config);
};

module.exports = {
  ...cli,
  execute
};
