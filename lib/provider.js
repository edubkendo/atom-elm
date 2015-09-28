'use babel';

const { BufferedNodeProcess } = require('atom');
const {sep, join} = require('path');
const { statSync } = require('fs');
const pathCache = new Map();

module.exports = {
  selector: '.source.elm',
  inclusionPriority: 1,
  excludeLowerPriority: false,

  getSuggestions({editor, bufferPosition, scopeDescriptor, prefix}) {
    return new Promise((resolve, reject) => {
      const lines = [];

      // Finds and caches the elm project path closest to the given path
      const findClosestElmProjectPath = function(pathParts) {
        const path = pathParts.length ? join(...pathParts) : '';

        if (pathCache.has(path)) {
          return pathCache.get(path);
        } else {
          try {
            const elmProjectPath = recursivelyFindClosestElmProjectPath(pathParts, path);
            pathCache.set(path, elmProjectPath);
            return elmProjectPath
          } catch (error) {
            displayAutoCompletionsUnavailableWarning();
            throw error;
          }
        }

        function recursivelyFindClosestElmProjectPath(pathParts, startPath) {
          const path = startPath
                     ? startPath
                     : pathParts.length
                     ? join(...pathParts)
                     : '';

          const exactDependenciesPath = path ? `${path}${sep}elm-stuff${sep}exact-dependencies.json` : '';

          if (path) {
            try {
              const stats = statSync(exactDependenciesPath);
              return path;
            } catch(e) {
              return recursivelyFindClosestElmProjectPath(pathParts.slice(0, -1));
            }
          } else {
            throw new Error('No elm project directory found');
          }
        }
      }

      const onProcessError = function({error, handle}) {
        if (atom.inDevMode()) {
          atom.notifications.addError('Elm Autocomplete Error', {
            detail: 'Failed to run:'
              + [executablePath, filePath, prefix].join(' ')
              + '\n\n'
              + 'From the following directory:'
              + elmProjectPath
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
        displayAutoCompletionsUnavailableWarning();
        return new Error('No elm-oracle suggestions');
      }

      const displayAutoCompletionsUnavailableWarning = function() {
        atom.notifications.addWarning('Elm AutoCompletions Unavailable', {
          detail: 'Please ensure you have:\n'
            + '  - Set the proper elm-oracle path\n'
            + '  - run `elm package install` within your project folder'
        });
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

      const filePath = editor.getPath();
      const elmProjectPath = findClosestElmProjectPath(filePath.split(sep).slice(0, -1));
      const executablePath = atom.config.get('language-elm.elmOraclePath');
      const options = {
        cwd: elmProjectPath,
        env: process.env
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
