const chalk = require('chalk');

const JSON_REGEX = /^( *)("[\w]+": )?("[^"]*"|[\w.+-]*)?([,[{]|\[\],?|\{\},?)?$/mg;

const colorMatch = (match, pIndent, pKey, pVal, pEnd) => {
  var r = pIndent || '';
  if (pKey) 
    r = r + chalk.white(pKey.replace(/[: ]/g, '')) + ': ';
  if (pVal)
    r = r + (pVal[0] == '"' ? chalk.green(pVal) : chalk.cyan(pVal));
  return r + (pEnd || '');
};

const colorise = obj => JSON.stringify(obj, null, 2).replace(JSON_REGEX, colorMatch);

module.exports = {
  colorise
};
