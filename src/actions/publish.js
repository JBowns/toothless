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
  options: [{ name: '--skip-npm', description: 'Don\'t attempt to publish the new packages to npm.' }],
  examples: [{ name: 'publish', description: 'Executes the complete publish workflow.' }],
  flags: {
    skipNpm: {
      type: 'boolean'
    }
  }
};

const execute = async () => {
  const { config } = await init({ verify: true });
  await blockRepositoryMerges(config);
  await lernaVersion(config);
  if (!cli.flags.skipNpm) {
    await lernaPublish(config);
  }
  await pushPublish(config);
  await unblockRepositoryMerges(config);
};

module.exports = {
  ...cli,
  execute
}
