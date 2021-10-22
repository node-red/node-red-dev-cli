const {Command, flags} = require('@oclif/command')
const getFromNPM = require('../libs/npmget')
const checkpackage = require('../libs/checkpackage')
const checknodes = require('../libs/checknodes')
const fs = require('fs');
const checkdeps = require('../libs/checkdeps');
const p = require('path');

let path = ''


function parsePackage(i){
  
  return [n,v]
}


class ValidateCommand extends Command {
  async run() {
    const {flags} = this.parse(ValidateCommand)
    const cli = this
    const npmstring = flags.npm
    let scorecard = {}
    let packagename
    let version
    let npm_metadata
    if (npmstring){
      if (npmstring.includes('@')){
        if (npmstring.indexOf('@') == 0) {
          packagename = '@'+npmstring.split('@')[1]
          version = npmstring.split('@')[2]
        } else{
          packagename = npmstring.split('@')[0]
          version = npmstring.split('@')[1]
        }
      } else {
        packagename = npmstring
        version = false
      }
      [path, npm_metadata] = await getFromNPM(packagename, version)
    } else if (flags.path){
      if(p.isAbsolute(flags.path)) {
        npm_metadata = false
        path = flags.path
      } else {
        npm_metadata = false
        path = process.cwd()+'/'+flags.path
      }
    } 
    else {
      path = process.cwd()
    }
    await checkpackage(path, cli, scorecard, npm_metadata)
    .then(scorecard => {
      let pkg = require(path+'/package.json')
      if (!pkg['node-red'].hasOwnProperty('nodes')){ //If no nodes declared skip node validation (could be a plugin)
        cli.warn('No nodes declared in package.json')
        return(scorecard)
      } else{
        return checknodes(path, cli, scorecard, npm_metadata)
      }
    })
    .then(scorecard => {
      return checkdeps(path, cli, scorecard, npm_metadata)
    })
    .then(() => {
      if (flags.output){
        try {
          fs.writeFileSync(flags.output+'/scorecard.json', JSON.stringify(scorecard))
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
  npm: flags.string({char: 'n', description: 'Name of package on npm to validate'}),
  path: flags.string({char: 'p', description: 'Path of package  to validate'}),
  output: flags.string({char: 'o', description: 'Path to write scorecard.json'}),
}


module.exports = ValidateCommand
