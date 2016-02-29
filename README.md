# language-elm package

Syntax highlighting and autocomplete for the [Elm language](http://elm-lang.org/).

## Installation

There are two ways to install the Atom Elm Extension: using the editor, or using the command line.

### Install using the editor (Recommended)

You can install packages within Atom. To do so:

  1. Open the editor settings
  2. Click the "Install" menu item
  3. Search for "language-elm"
  4. Click the install button on the "language-elm" result
  
[More documentation for how to use the package manager](https://atom.io/docs/v1.5.3/using-atom-atom-packages) can be found on the official Atom site.

#### Screenshot

![Screenshot of installation](https://raw.githubusercontent.com/edubkendo/atom-elm/better-instructions/screenshot.png)

### Install using the command line

Run the following command in your terminal:

```apm install language-elm```

## Autocomplete

In order to get autocomplete working, please:

  1. Open up a terminal
  2. `npm install -g elm-oracle`
  3. `which elm-oracle` on Unix/Linux or `where.exe elm-oracle` on Windows
  4. Copy the path to elm-oracle
  5. Open up the language-elm settings in Atom  
    - Open up the Atom Settings / Preferences tab
    - Click on "Packages"
    - Find the "language-elm" package in the list
    - Click "Settings"
  6. Paste the path into "The elm-oracle executable path" setting

Thanks to the authors of [Elm Oracle](https://github.com/ElmCast/elm-oracle)

## Jump to Symbol

Atom's native symbol-view package uses ctags, and thus doesn't support Elm without extra configuration. But this plugin https://atom.io/packages/goto uses langauge definition files to identify symbols, and does support Elm as long as atom-elm is installed.
