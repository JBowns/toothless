const { init } = require('../core/state');
const { colorise } = require('../utils/json');

const cli = {
  command: 'config',
  options: [{ name: '--verify', description: 'Ensures the runtime configuration is valid' }],
  examples: [{ name: 'config', description: ' Gathers information about npm, github and git and then prints the relevant configuration.' }],
  flags: {
    verify: {
      type: 'boolean'
    }
  }
};

const execute = async (cli) => {
  const state = await init(cli, { verify: cli.flags.verify });
  console.log(colorise(state));
};

module.exports = {
  ...cli,
  execute
};
