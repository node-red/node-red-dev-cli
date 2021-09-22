const os = require('os')
const fs = require('fs');
const { t } = require('tar');
const { SemVer } = require('semver');
const p = require('path')
const nodegit = require('nodegit');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
   
function checkpackage(path, cli, scorecard) {
    const package = require(path+'/package.json');
    scorecard.package = {}
    return new Promise((resolve, reject) => {
        cli.log('Validating Package')    
        resolve();
      })
    .then(() => {
        //MUST Have a License
        if (package.hasOwnProperty('license')){
            cli.log(`✅ Package is ${package.license} licensed`)
            scorecard.package.license = {'test' : true}
        } else {
            cli.error('No License Specified')
            scorecard.package.license = {'test' : false}
        }
      })
      .then(() => {
        //MUST Have Repository or Bugs url/email
        if (package.hasOwnProperty('repository') || package.hasOwnProperty('bugs')){
            cli.log(`✅ Repository/Bugs Link Suppllied`)
            scorecard.package.bugs = {'test' : true}
        } else {
            cli.error('Please provide either a repoistory URL or a Bugs URL/Email')
            scorecard.package.bugs = {'test' : false}
        }
      })
    .then(() => {
         //Check package in repository is the same name as the package.json (check for forks) - This may need more thought and testing
        if (package.hasOwnProperty('repository')){
            let repourl = package.repository.url
            let repo = p.basename(repourl)
            const repopath = os.tmpdir()+'/'+repo
            if (!fs.existsSync(repopath)){
                fs.mkdirSync(repopath);
            } else{
                fs.rmSync(repopath+'/', { recursive:true })
            }
            return nodegit.Clone(repourl, repopath)
            .then(function (r){
                let path = r.workdir()
                let repopackage = require(path+'/package.json')
                if (package.name != repopackage.name){
                    cli.warn('Package name differes from package in repoistory')
                    readline.question('Is this a fork of an existing package?', note => {
                        scorecard.package.name = { 'test' : false, 'note' : note}
                        readline.close();
                    });
                } else {
                    cli.log('✅ Package Name Matches Repository')
                    scorecard.package.name = {'test' : true}
                }
        })
    }
    })
    .then(() => {
        //SHOULD Use a Scoped name
        const scopedRegex = new RegExp('@[a-z\\d][\\w-.]+/[a-z\\d][\\w-.]*');
        if (scopedRegex.test(package.name)){
            cli.log('✅ Package uses a Scoped Name')
            scorecard.package.scopedname = { 'test' : true}
        } else {
            cli.warn('New Packages SHOULD use a scoped name')
            scorecard.package.scopedname = { 'test' : false}
        }     
    })
    .then(() => {
       //MUST have Node-RED in keywords
    if (package.hasOwnProperty('keywords') && package.keywords.includes('node-red')){
        cli.log(`✅ Node-RED Keyword Found`)
        scorecard.package.keyword = { 'test' : true}
    } else {
        cli.error('Keywords MUST contain node-red')
    }   
    })
    .then(() => {
      //SHOULD declare min node-red version in node-red
        if (package['node-red'].hasOwnProperty('version')){
            const versions = axios.get('https://registry.npmjs.org/node-red')
            .then(response => {
            let tags = response['dist-tags']
            let supportedRegex = new RegExp('.*maintenance.*|^latest$') // check which versions have a latest or maintaince tag
            let versions = []
            Object.keys(tags).forEach(t => {
	            if (supportedRegex.test(t)) {
    		        versions.push(tags[t])
	            }
            });
            resolve(versions)
        })
        //Test version against current versions
        let compatible = false
        versions.forEach(v  => {
             if (semver.satisfies(v, package['node-red'].version)){
                 cli.log(`✅ Compatible with Node-RED v${v}`)
                 compatible = true
             } else {
                 cli.warn(`NOT Compatible with Node-RED v${v}`)
             }
             if (!compatible){
                 cli.error('Not Compatible with any current Node-RED versions')
             }

        })
        } else {
            cli.warn('Node-RED version compatiblity not declared')
        }    
    })
    .then(() => {
        //SHOULD declare min node version in engines
        if ( package.hasOwnProperty('engines') && package.engines.hasOwnProperty('node')){
            cli.log('✅ Engine compatilble') //TODO match against supported NR versions
        } else {
            cli.warn('Node version not declared in engines')
        }  
    })
    .then(() => {
        //Check for other package of same name in different scope, ask about fork?
        console.log('check names') //TODO
    })
    .then(() => {
        console.log('resolve scorecard')
        return scorecard
    })
    .catch(() => {
        cli.error('Error');
      });

}

module.exports = checkpackage
