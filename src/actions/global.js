module.exports = {
  options: [{ name: '--skip-npm-verification', description: 'Don\'t attempt to verify the npm profile.' }],
  flags: {
    skipNpmVerification: {
      type: 'boolean'
    }
  }
};
