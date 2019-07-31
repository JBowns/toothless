const { init } = require('./utils/cli');
const { global, publish, verify, version, push } = require('./actions');
const { formatException } = require('./utils/error');

const { cli, action } = init(process.argv[2], [ publish, verify, version, push ], global);

if (action) {
  action.execute(cli)
    .catch(err => {
      console.log(formatException(err));
      process.exit(1);
    });
} else {
  console.log(cli.help);
}
