const {Command, flags} = require('@oclif/command')
const getFromNPM = require('../libs/npmget')
const checkpackage = require('../libs/checkpackage')
const checknodes = require('../libs/checknodes')
const fs = require('fs');
const checkdeps = require('../libs/checkdeps');
const p = require('path');

let path = ''

class ValidateCommand extends Command {
  async run() {
    const {flags} = this.parse(ValidateCommand)
    const packagename = flags.npm
    let scorecard = {}
    const cli = this
    if (packagename) {
      path = await getFromNPM(packagename)
    } else if (flags.path){
      if(p.isAbsolute(flags.path)) {
        path = flags.path
      } else {
        path = process.cwd()+'/'+flags.path
      }
    } 
    else {
      path = process.cwd()
    }
    await checkpackage(path, cli, scorecard)
    .then(scorecard => {
      return checknodes(path, cli, scorecard)
    })
    .then(scorecard => {
      return checkdeps(path, cli, scorecard)
    })
    .then(() => {
      if (flags.card){
        try {
          fs.writeFileSync(flags.card+'/scorecard.json', JSON.stringify(scorecard))
        } catch (err) {
          cli.error(err) . m
        }
      }
    })
    
    .catch((e)=> {
      cli.error(e)
    })
    .then(() =>{
      cli.log('Complete')
    })
    cli.exit()
  }
}



ValidateCommand.description = `Run the full suite of Validation tests
...
By default the tool will look in the current folder for a package, 
you can also specify a path with --path or a published npm package with --npm.
`

ValidateCommand.flags = {
  npm: flags.string({char: 'npm', description: 'Name of package on npm to validate'}),
  path: flags.string({char: 'path', description: 'Path of package  to validate'}),
  card: flags.string({char: 'card', description: 'Path to write scorecard.json'}),
}


module.exports = ValidateCommand
