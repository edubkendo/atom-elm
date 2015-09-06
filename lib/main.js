'use babel';

const provider = require('./provider');
const { join } = require('path');

module.exports = {
  config: {
    elmOraclePath: {
      title: 'The elm-oracle executable path.',
      type: 'string',
      default: join(__dirname, '..', 'node_modules', '.bin', 'elm-oracle')
    }
  },

  provide() {
    return [provider];
  }
}
