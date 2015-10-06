'use babel';

const { BufferedNodeProcess } = require('atom');
const { spawn } = require('child_process');
const { statSync } = require('fs');
const { sep: pathSep,
        join: joinPath,
        resolve: resolvePath } = require('path');

const LOG_PREFIX = 'Elm Autocomplete: ';
const RELATIVE_EXACT_DEPS_PATH = joinPath('elm-stuff', 'exact-dependencies.json');

const pathCache = new Map();
let seenUnavailableWarning = false;

const getPrefix = (editor, bufferPosition) => {
  const regex = /[.\w0-9_-]+$/;
  const line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);

  return line.match(regex) ? line.match(regex)[0] : '';
}

const shouldPreventAutocomplete = (prefix) => {
  return prefix.length < atom.config.get('language-elm.minCharsForAutocomplete')
      || !atom.config.get('language-elm.autocompleteEnabled');
}

module.exports = {
  selector: '.source.elm',
  disableForSelector: '.comment, .string',
  inclusionPriority: 1,
  excludeLowerPriority: false,

  getSuggestions({editor, bufferPosition, scopeDescriptor}) {
    const prefix = getPrefix(editor, bufferPosition);

    if (shouldPreventAutocomplete(prefix)) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const lines = [];
      const filePath = editor.getPath();
      const elmProjectPath = findClosestElmProjectPath(filePath.split(pathSep).slice(0, -1));
      const executablePath = atom.config.get('language-elm.elmOraclePath');
      const options = {
        cwd: elmProjectPath,
        env: process.env
      };

      const accumulateOutput = (line) => {
        lines.push(line)
      };

      const provideSuggestions = () => {
        resolve(
          toAutocompletePlusSuggestions(
            toOracleSuggestions(
              parseOutput(lines[0]))));
      };

      if (atom.inDevMode()) {
        console.log(`${LOG_PREFIX} Executing - ${executablePath} ${filePath} ${prefix}`);
        console.log(`${LOG_PREFIX} From Directory - ${elmProjectPath}`);
        console.log('');
      }

//Fix for windows as BufferedNodeProcess doesn't spawn properly; see Atom issue 2887.
//May not be the best way but works for now.
      if (process.platform !== 'win32') {
      (new BufferedNodeProcess({
        command: executablePath,
        args: [filePath, prefix],
        options: options,
        stdout: accumulateOutput,
        exit: provideSuggestions
      })).onWillThrowError(onProcessError);
    } else {

        var results = spawn('cmd.exe',
        ['/c', executablePath, filePath, prefix], options);

        results.stdout.on('data', function(data) {
        accumulateOutput(data.toString());
        });

        results.on('close', function(status) {
          provideSuggestions(status);
        });
      }
    });
  }
};

const toAutocompletePlusSuggestions = (oracleSuggestions) => {
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
const parseTabStops = (signature) => {
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

const buildAbsolutePath = (pathParts) => resolvePath(pathSep, ...pathParts);

const recursivelyFindClosestElmProjectPath = (pathParts, startPath) => {
  const path = startPath
             ? startPath
             : pathParts.length
             ? buildAbsolutePath(pathParts)
             : '';
  let exactDependenciesPath;

  if (path) {
    exactDependenciesPath = joinPath(path, RELATIVE_EXACT_DEPS_PATH);

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

// Finds and caches the elm project path closest to the given path
const findClosestElmProjectPath = (pathParts) => {
  const path = pathParts.length ? buildAbsolutePath(pathParts) : '';

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
}

const onProcessError = ({error, handle}) => {
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

const oracleSuggestionsParseError = (error) => {
  if (atom.inDevMode()) {
    atom.notifications.addError('Elm Autocomplete Error', {
      detail: 'Failed to parse elm-oracle suggestions. Full error message: \n\n' + error.message
    });
  }

  throw error;
};

const noOutputFromOracleError = () => {
  displayAutoCompletionsUnavailableWarning();
  return new Error('No elm-oracle suggestions');
}

const displayAutoCompletionsUnavailableWarning = () => {
  if (seenUnavailableWarning) {
    return;
  }

  atom.notifications.addWarning('Elm AutoCompletions Unavailable', {
    detail: 'Please ensure you have:\n'
      + '  - Set the proper elm-oracle path\n'
      + '  - run `elm package install` within your project folder'
  });

  seenUnavailableWarning = true;
}

const toOracleSuggestions = (text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
     throw oracleSuggestionsParseError(error);
  }
};

const parseOutput = (text) => {
  text = text && text.slice(0, text.indexOf('\n'));

  if (!text) {
    throw noOutputFromOracleError();
  } else {
    return text;
  }
}
