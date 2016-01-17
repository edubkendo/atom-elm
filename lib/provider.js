'use babel'

const { File } = require('atom')
const getSuggestionsFromElmOracle = require('./elmOracle')

module.exports = {
  selector: '.source.elm',
  disableForSelector: '.comment, .string',
  inclusionPriority: 1,
  excludeLowerPriority: false,

  getSuggestions ({editor, bufferPosition, scopeDescriptor}) {
    const prefix = getPrefix(editor, bufferPosition)
    const filePath = editor.getPath()

    return shouldProvideSuggestions(prefix, filePath)
      .then(getElmOracleSuggestionsIfNecessary(prefix, filePath))
      .then(mapToAutocompletePlusSuggestions)
      .catch(onError)
  }
}

const getPrefix = (editor, bufferPosition) => {
  const regex = /[.\w0-9_-]+$/
  const line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition])

  return line.match(regex) ? line.match(regex)[0] : ''
}

const shouldProvideSuggestions = (prefix, filePath) => {
  const shouldNotProvideSuggestions =
    prefix.length < atom.config.get('language-elm.minCharsForAutocomplete') ||
      !atom.config.get('language-elm.autocompleteEnabled') ||
      !filePath

  if (shouldNotProvideSuggestions) {
    return Promise.resolve(false)
  } else {
    return new File(filePath).exists()
  }
}

const getElmOracleSuggestionsIfNecessary = (prefix, filePath) => {
  return (shouldProvideSuggestions) => {
    if (shouldProvideSuggestions) {
      return getSuggestionsFromElmOracle(prefix, filePath)
    } else {
      return []
    }
  }
}

// -- Autocomplete Plus Formatting
const mapToAutocompletePlusSuggestions = (oracleSuggestions) => {
  return oracleSuggestions.map(({comment, fullName, href, name, signature}) => {
    return {
      type: 'function',
      snippet: (name + ' ' + parseTabStops(signature)),
      displayText: name,
      rightLabel: signature,
      description: fullName + (comment ? ': ' + comment : ''),
      descriptionMoreURL: href
    }
  })
}

/**
 * TODO: This function works for some cases, but needs a rework with unit tests.
 * Shouldn't block initial release, but requires follow up.
 *
 * Variety of signatures to parse:
 *   - Signal#merge
 *   - Signal#map5
 *   - Html.Attributes#style
 *   - Basics#curry
 *   - List#partition
 *   - Color#radial
 */
const parseTabStops = (signature) => {
  return signature.split(')')
    .filter((suggestion) => suggestion.trim().length)
    .reduce((acc, part) => {
      if ((/\(/g).test(part)) {
        acc.tabStops.push('${' + ++acc.position + ':(' + part.replace(/\(|^(\ ?->)\ /g, '') + ')}')
      } else {
        part
          .split('->')
          .filter((part) => part.trim().length)
          .slice(0, -1)
          .forEach((part) => {
            acc.tabStops.push('${' + ++acc.position + ':' + part.trim() + '}')
          })
      }

      return acc
    }, { tabStops: [], position: 0 }).tabStops.join(' ')
}

// -- Error States
const onError = (error) => {
  displayAutoCompletionsUnavailableWarning()

  if (atom.inDevMode()) {
    console.error(error)
  }
}

let seenUnavailableWarning = false
const displayAutoCompletionsUnavailableWarning = () => {
  if (seenUnavailableWarning) {
    return
  }

  atom.notifications.addWarning('Elm AutoCompletions Unavailable', {
    detail: 'Please ensure you have:\n' +
      '  - Set the proper elm-oracle path\n' +
      '  - run `elm package install` within your project folder'
  })

  seenUnavailableWarning = true
}
