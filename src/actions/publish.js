const { init } = require('../core/state');
const {
  blockRepositoryMerges,
  unblockRepositoryMerges,
  lernaVersion,
  lernaPublish,
  pushPublish
} = require('../core/actions');

const cli = {
  command: 'publish',
  options: [{ name: '--skip-npm-publish', description: 'Don\'t attempt to publish the new packages to npm.' }],
  examples: [{ name: 'publish', description: 'Executes the complete publish workflow.' }],
  flags: {
    skipNpmPublish: {
      type: 'boolean'
    }
  }
};

const execute = async (cli) => {
  const { config } = await init(cli, { verify: true });
  const { flags: { skipNpmPublish } } = cli;
  await blockRepositoryMerges(config);
  await lernaVersion(config);
  if (!skipNpmPublish) {
    await lernaPublish(config);
  }
  await pushPublish(config);
  await unblockRepositoryMerges(config);
};

module.exports = {
  ...cli,
  execute
};
