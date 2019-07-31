const { init } = require('../core/state');

const cli = {
  command: 'verify',
  options: [],
  examples: [{ name: 'verify', description: ' Gathers information about npm, github and git to ensure the repository is in a valid state and then prints the relevant configuration.' }],
  flags: {}
};

const execute = async (cli) => {
  const { config } = await init(cli);
  console.log(JSON.stringify(config, null, 2));
};

module.exports = {
  ...cli,
  execute
};
