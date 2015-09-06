'use babel';

const { BufferedNodeProcess } = require('atom');
const path = require('path');

module.exports = {
  selector: '.source.elm',
  inclusionPriority: 1,
  excludeLowerPriority: false,

  getSuggestions({editor, bufferPosition, scopeDescriptor, prefix}) {
    return new Promise((resolve, reject) => {
      const filePath = editor.getPath();
      const fileFolder = path.join(...filePath.split(path.sep).slice(0, -1));
      const lines = [];
      const executablePath = atom.config.get('atom-elm-autocomplete.elmOraclePath');
      const options = {
        cwd: fileFolder,
        env: process.env
      };

      const onProcessError = function({error, handle}) {
        if (atom.inDevMode()) {
          atom.notifications.addError('Elm Autocomplete Error', {
            detail: 'Failed to run:'
              + [executablePath, filePath, prefix].join(' ')
              + '\n\n'
              + 'From the following directory:'
              + fileFolder
              + '\n\n'
              + error.message
          });
        }

        handle();

        throw error;
      };

      const oracleSuggestionsParseError = function(error) {
        if (atom.inDevMode()) {
          atom.notifications.addError('Elm Autocomplete Error', {
            detail: 'Failed to parse elm-oracle suggestions. Full error message: \n\n' + error.message
          });
        }

        throw error;
      };

      const noOutputFromOracleError = function() {
        atom.notifications.addWarning('Elm AutoCompletions Unavailable', {
          detail: 'Please ensure you have:\n'
            + '  - Set the proper elm-oracle path\n'
            + '  - run `elm package install` within your project folder'
        });

        return new Error('No elm-oracle suggestions');
      }

      const toOracleSuggestions = function(text) {
        try {
          return JSON.parse(text);
        } catch (error) {
           throw oracleSuggestionsParseError(error);
        }
      };

      const parseOutput = function(text) {
        text = text && text.slice(0, text.indexOf('\n'));

        if (!text) {
          throw noOutputFromOracleError();
        } else {
          return text;
        }
      }

      const accumulateOutput = function(line) {
        lines.push(line)
      };

      const provideSuggestions = function() {
        resolve(
          toAutocompletePlusSuggestions(
            toOracleSuggestions(
              parseOutput(lines[0]))));
      };

      (new BufferedNodeProcess({
        command: executablePath,
        args: [filePath, prefix],
        options: options,
        stdout: accumulateOutput,
        exit: provideSuggestions
      })).onWillThrowError(onProcessError);
    });
  }
};

const toAutocompletePlusSuggestions = function(oracleSuggestions) {
  return oracleSuggestions.map(({comment, fullName, href, name, signature}) => {
    return {
      type: 'function',
      snippet: (name + ' ' + parseTabStops(signature)),
      displayText: name,
      rightLabel: signature,
      description: fullName + (comment ? ': ' + comment : ''),
      descriptionMoreURL: href
    };
  });
};

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
const parseTabStops = function(signature) {
  return signature.split(')')
    .filter((suggestion) => suggestion.trim().length)
    .reduce((acc, part) => {
      if ((/\(/g).test(part)) {
        acc.tabStops.push('${' + ++acc.position + ':(' + part.replace(/\(|^(\ ?->)\ /g, '') + ')}');
      } else {
        part
          .split('->')
          .filter((part) => part.trim().length)
          .slice(0, -1)
          .forEach((part) => {
            acc.tabStops.push('${' + ++acc.position + ':' + part.trim() + '}');
          });
      }

      return acc;
    }, { tabStops: [], position: 0 }).tabStops.join(' ');
};
