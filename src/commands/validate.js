const {Command, flags} = require('@oclif/command')
const getFromNPM = require('../libs/npmget')
const checkpackage = require('../libs/checkpackage')
const fs = require('fs');

let path = ''

class ValidateCommand extends Command {
  async run() {
    const {flags} = this.parse(ValidateCommand)
    const packagename = flags.npm
    let scorecard = {}
    const cli = this
    if (packagename) {
      path = await getFromNPM(packagename)
    } else {
      path = '.'
    }
    await checkpackage(path, this, scorecard)
    .then(scorecard => {
      if (flags.card){
        try {
          fs.writeFileSync(flags.card+'/scorecard.json', JSON.stringify(scorecard))
        } catch (err) {
          cli.error(err) . m
        }
      }
    })
    .catch(()=> {
      cli.error('Error')
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
  npm: flags.string({char: 'npm', description: 'name of package on npm to validate'}),
  path: flags.string({char: 'path', description: 'Path of package  to validate'}),
  card: flags.string({char: 'scorecard', description: 'Path of package  to validate'}),
}


module.exports = ValidateCommand
