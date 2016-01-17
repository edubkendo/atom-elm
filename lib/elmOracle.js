'use babel'

const { BufferedNodeProcess } = require('atom')
const { spawn } = require('child_process')
const { statSync } = require('fs')
const path = require('path')

const RELATIVE_EXACT_DEPS_PATH = path.join('elm-stuff', 'exact-dependencies.json')
const PATH_CACHE = new Map()
const LOG_PREFIX = 'Elm Autocomplete: '

module.exports = (prefix, filePath) => {
  return new Promise(resolve => {
    const lines = []
    const elmProjectPath = findClosestElmProjectPath(filePath.split(path.sep).slice(0, -1))
    const executablePath = atom.config.get('language-elm.elmOraclePath')
    const options = {
      cwd: elmProjectPath,
      env: process.env
    }

    const accumulateOutput = (line) => {
      lines.push(line)
    }

    const provideSuggestions = () => {
      resolve(JSON.parse((parseOutput(lines[0]))))
    }

    if (atom.inDevMode()) {
      console.log(`${LOG_PREFIX} Executing - ${executablePath} ${filePath} ${prefix}`)
      console.log(`${LOG_PREFIX} From Directory - ${elmProjectPath}`)
    }

    const onProcessError = ({error, handle}) => {
      if (atom.inDevMode()) {
        atom.notifications.addError('Elm Autocomplete Error', {
          detail: 'Failed to run:' +
            [executablePath, filePath, prefix].join(' ') +
            '\n\n' +
            'From the following directory:' +
            elmProjectPath +
            '\n\n' +
            error.message
        })
      }

      handle()

      throw error
    }

    // Fix for windows as BufferedNodeProcess doesn't spawn properly; See Atom issue 2887.
    if (process.platform === 'win32') {
      var results = spawn(getCmdPath(), ['/c', executablePath, filePath, prefix], options)

      results.stdout.on('data', function (data) {
        accumulateOutput(data.toString())
      })

      results.on('close', function () {
        provideSuggestions()
      })

      results.on('error', function (err) {
        throw err
      })
    } else {
      (new BufferedNodeProcess({
        command: executablePath,
        args: [filePath, prefix],
        options: options,
        stdout: accumulateOutput,
        exit: provideSuggestions
      })).onWillThrowError(onProcessError)
    }
  })
}

const recursivelyFindClosestElmProjectPath = (pathParts, startPath) => {
  const projectPath = startPath ||
  pathParts.length
    ? buildAbsolutePath(pathParts)
    : ''

  let exactDependenciesPath

  if (projectPath) {
    exactDependenciesPath = path.join(projectPath, RELATIVE_EXACT_DEPS_PATH)

    try {
      statSync(exactDependenciesPath)
      return projectPath
    } catch (e) {
      return recursivelyFindClosestElmProjectPath(pathParts.slice(0, -1))
    }
  } else {
    throw new Error('No elm project directory found')
  }
}

const buildAbsolutePath = (pathParts) => path.resolve(path.sep, ...pathParts)

// Finds and caches the elm project path closest to the given path
const findClosestElmProjectPath = (pathParts) => {
  const path = pathParts.length ? buildAbsolutePath(pathParts) : ''

  if (PATH_CACHE.has(path)) {
    return PATH_CACHE.get(path)
  } else {
    try {
      const elmProjectPath = recursivelyFindClosestElmProjectPath(pathParts, path)
      PATH_CACHE.set(path, elmProjectPath)
      return elmProjectPath
    } catch (error) {
      throw error
    }
  }
}

const parseOutput = (text) => {
  text = text && text.slice(0, text.indexOf('\n'))

  if (!text) {
    throw new Error('No elm-oracle suggestions')
  } else {
    return text
  }
}

const getCmdPath = () => {
  if (process.env.comspec) {
    return process.env.comspec
  } else if (process.env.SystemRoot) {
    return path.join(process.env.SystemRoot, 'System32', 'cmd.exe')
  } else {
    return 'cmd.exe'
  }
}
