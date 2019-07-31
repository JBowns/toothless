const meow = require('meow');
const chalk = require('chalk');
const { formatException } = require('./error');

const handleCLIException = (err, cli) => {
  console.log(cli.help);
  console.log(formatException(err));
  process.exit(127);
};

const verifyAction = ({ input }, action) => {
  if (!action && input.length > 0) {
    throw new Error(`unknown action '${input.join(' ')}'`);
  }
};

const verifyFlags = ({ flags: actualFlags }, { flags: expectedFlags = {} }) => {
  const activeFlags = Object.entries(actualFlags).filter(([, active]) => Boolean(active)).map(([flag]) => flag);
  const availableFlags = Object.keys(expectedFlags);
  activeFlags.forEach(active => {
    if (!availableFlags.find(flag => flag === active)) {
      throw new Error(`unknown flag '${active}'`);
    }
  });
};

const buildKeyValue = (arr = []) => {
  if (arr.length === 0) {
    return undefined;
  }
  return arr.map(({ name, description = '' }) => `    ${name}    ${chalk.gray(description)}`).join('\n')
};

const buildCommand = ({ command = '', actions = [], options = [], globals = [] }) => {
  const args = [
    command,
    actions.length ? '<action>' : '',
    options.length || globals.length ? '[options]' : '',
  ].filter(Boolean).join(' ');
  return `    $ toothless ${args}`;
};

const buildUsage = ({ command, actions, options, globals, examples }) => {
  const usage = [{
    header: 'Usage',
    body: buildCommand({ command, actions, options, globals, examples })
  }, {
    header: 'Actions',
    body: buildKeyValue(actions)
  }, {
    header: 'Options',
    body: buildKeyValue(options)
  }, {
    header: 'Globals',
    body: buildKeyValue(globals)
  }, {
    header: 'Examples',
    body: buildKeyValue(examples)
  }];
  return usage.reduce((out, { header, body }) => {
    return body ? `${out}\n  ${chalk.cyan(header)}\n${body}\n` : out;
  }, '');
};

const init = (input, actions, global) => {
  const root = {
    actions: actions.reduce((arr, { examples = [{}] }) => ([...arr, ...examples]), []),
    options: [],
    examples: [],
    flags: {},
  };
  const action = actions.find(({ command }) => command === input);
  const { flags, ...args } = action || root;
  const opts = { flags: { ...flags, ...global.flags } };
  const cli = meow(buildUsage({ ...args, globals: global.options }), opts);

  try {
    verifyAction(cli, action);
    verifyFlags(cli, opts);
  } catch (err) {
    handleCLIException(err, cli);
  }

  return { cli, action };
}

module.exports = {
  init
};
