const chalk = require('chalk');

const formatException = ({ message }) => {
  let [ prefix, body ] = message.split(/:(.+)/);
  if (!body || prefix.length > 7) {
    body = message;
    prefix = 'Error:';
  }
  return `${chalk.red(prefix)} ${body}`;
};

module.exports = {
  formatException
};
