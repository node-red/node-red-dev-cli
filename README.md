node-red-dev
============

Node-RED Node Developer Tools

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/node-red-dev.svg)](https://npmjs.org/package/node-red-dev)
[![Downloads/week](https://img.shields.io/npm/dw/node-red-dev.svg)](https://npmjs.org/package/node-red-dev)
[![License](https://img.shields.io/npm/l/node-red-dev.svg)](https://github.com/node-red/node-red-dev/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage
<!-- usage -->
```sh-session
$ npm install -g node-red-dev
$ node-red-dev COMMAND
running command...
$ node-red-dev (-v|--version|version)
node-red-dev/0.0.6 darwin-x64 node-v14.15.3
$ node-red-dev --help [COMMAND]
USAGE
  $ node-red-dev COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`node-red-dev help [COMMAND]`](#node-red-dev-help-command)
* [`node-red-dev validate`](#node-red-dev-validate)

## `node-red-dev help [COMMAND]`

display help for node-red-dev

```
USAGE
  $ node-red-dev help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.3/src/commands/help.ts)_

## `node-red-dev validate`

Run the full suite of Validation tests

```
USAGE
  $ node-red-dev validate

OPTIONS
  -c, --card=card  Path to write scorecard.json
  -n, --npm=npm    Name of package on npm to validate
  -p, --path=path  Path of package  to validate

DESCRIPTION
  ...
  By default the tool will look in the current folder for a package, 
  you can also specify a path with --path or a published npm package with --npm.
```

_See code: [src/commands/validate.js](https://github.com/node-red/node-red-dev-cli/blob/v0.0.6/src/commands/validate.js)_
<!-- commandsstop -->
