'use babel'

const provider = require('./provider')
const { join } = require('path')

module.exports = {
  config: {
    autocompleteEnabled: {
      title: 'Enable autocomplete',
      type: 'boolean',
      default: true
    },
    elmOraclePath: {
      title: 'The elm-oracle executable path (used for autocomplete)',
      type: 'string',
      default: join(__dirname, '..', 'node_modules', '.bin', 'elm-oracle')
    },
    minCharsForAutocomplete: {
      title: 'The min number of characters to enter before autocomplete appears',
      type: 'number',
      default: 1
    }
  },

  provide () {
    return [provider]
  }
}
