const os = require('os')
const fs = require('fs');
const { t } = require('tar');
const semver = require('semver');
const p = require('path')
const nodegit = require('nodegit');
const axios = require('axios')
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });


function isGitUrl(str) {
  //var regex = /(?:git|ssh|https?|git@[-\w.]+):(\/\/)?(.*?)(\.git)(\/?|\#[-\d\w._]+?)$/;
  var regex = /(?:git|ssh|https?|git@[-\w.]+):(\/\/)?(.*?)(\/?|\#[-\d\w._]+?)$/;
  return regex.test(str);
};
  

function checkpackage(path, cli, scorecard, npm_metadata) {
    const package = require(path+'/package.json');
    scorecard.package = {}
    return new Promise((resolve, reject) => {
        cli.log('    ---Validating Package---')
        cli.log(`   ${package.name}@${package.version}`)    
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
            cli.log(`✅ Repository/Bugs Link Supplied`)
            scorecard.package.bugs = {'test' : true}
        } else {
            cli.warn('Please provide either a repository URL or a Bugs URL/Email')
            scorecard.package.bugs = {'test' : false}
        }
      })
    .then(() => {
         // Check package in repository is the same name as the package.json (check for forks) - This may need more thought and testing
         // Need to rethink this test due to mono-repos, not listed repos etc, 
        if (package.hasOwnProperty('repository')){
            let repourl = package.repository.url
            let repo = p.basename(repourl)
            const repopath = os.tmpdir()+'/'+repo
            if (!fs.existsSync(repopath)){
                fs.mkdirSync(repopath);
            } else{
                fs.rmSync(repopath+'/', { recursive:true })
            }
            //Fix for repourls that contain credentials eg 'git@github.com:username/project.git'
            if (repourl.indexOf('@') != -1){ repourl = 'https://'+repourl.replace(':', '/').split('@')[1]}
            if (!isGitUrl(repourl)){
                cli.error('Invalid Repository URL: '+ repourl)
            }
            return nodegit.Clone(repourl, repopath)
            .then(function (r){
                if (package.repository.hasOwnProperty('directory')){
                    let path = r.workdir()+package.repository.directory
                } else{
                    let path = r.workdir()
                }
                let repopackage = require(path+'/package.json')
                if (package.name != repopackage.name){
                    cli.warn('Package name does not match package.json in repository')
                } else {
                    cli.log('✅ Package Name Matches Repository')
                    scorecard.package.name = {'test' : true}
                }
            })
            .catch((e) =>{
                cli.error('Failed to clone git repository '+e)
            })
        } else {
            cli.warn('No Repository listed in package.json')
        }

    })
    .then(() => {
        let legacy = false
        const scopedRegex = new RegExp('@[a-z\\d][\\w-.]+/[a-z\\d][\\w-.]*');
        if (npm_metadata){
            //New packages should Use a Scoped name
            let scoped_start= Date.parse('2021-12-01T00:00:00.000Z') //Packages should use scoped from 1st Dec 2021
            let created = Date.parse(npm_metadata.time.created)
            if (created<scoped_start){
                legacy = true
            }
        }
        if (!legacy){
            if (scopedRegex.test(package.name)){
                cli.log('✅ Package uses a Scoped Name')
                scorecard.package.name = { 'test' : true}
            } else {
                cli.warn('New Packages should use a scoped name')
                scorecard.package.name = { 'test' : false}
            }    
        }
        if (!scopedRegex.test(package.name)) {
            const contribRegex = new RegExp('/^(node-red|nodered)(?!-contrib-).*/ig')
            if (contribRegex.test(package.name)){
                cli.warn('Packages using the node-red prefix in their name must use node-red-contrib')
                scorecard.package.name = { 'test' : false}
            } else {
                cli.log('✅ Package uses a valid name')
                scorecard.package.name = { 'test' : true}
            }


        }         
    })
    .then(() => {
        //Check for other package of same name in different scope, ask about fork?
        scorecard.package.uniqname = {test : true}
        const name = package.name.split('/').slice(-1) // Package name without scope
        let similar = false
        let similarlist = []
        return axios.get('https://catalogue.nodered.org/catalogue.json')
        .then(response => {               
            response.data.modules.forEach((m) => {
                if (name.includes(m.id.split('/').slice(-1))){
                    cli.warn(`Similar named package found at ${m.id}`)
                    similar = true
                    similarlist.push(m.id)
                }
            })
            if (similar){
                scorecard.package.uniqname.test = false
                scorecard.package.uniqname.similar = similarlist
            } else {
                cli.log('✅ No similar named packages found')
            }
            return similar
        })
        scorecard.package.uniqname.test = !test
    })
    .then(() => {
       //MUST have Node-RED in keywords
    if (package.hasOwnProperty('keywords') && package.keywords.includes('node-red')){
        cli.log(`✅ Node-RED Keyword Found`)
        scorecard.package.keyword = { 'test' : true}
    } else {
        cli.warn('Package.json keywords MUST contain node-red')
    }   
    })
    .then(() => {
      //SHOULD declare min node-red version in node-red
        if (package['node-red'].hasOwnProperty('version')){
            return axios.get('https://registry.npmjs.org/node-red')
            .then(response => {
            let tags = response.data['dist-tags']
            let supportedRegex = new RegExp('.*maintenance.*|^latest$') // check which versions have a latest or maintaince tag
            let versions = []
            Object.keys(tags).forEach(t => {
	            if (supportedRegex.test(t)) {
    		        versions.push(tags[t])
	            }
            });
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
                    cli.warn('Not Compatible with any current Node-RED versions')
                }
            })
        })
        } else {
            cli.warn('Node-RED version compatiblity not declared')
        }    
    })
    .then(() => {
        //SHOULD declare min node version in engines
        scorecard.nodeversion
        if ( package.hasOwnProperty('engines') && package.engines.hasOwnProperty('node')){
            return axios.get('https://registry.npmjs.org/node-red')
            .then(response => {               
                nminversion = semver.minVersion(response.data.versions[response.data["dist-tags"].latest].engines.node)
                if  (semver.satisfies(nminversion, package.engines.node)){
                    cli.log(`✅ Compatible NodeJS Version found ${nminversion}`)   
                } else {
                    cli.error('Minimum Node version is not compatible with minimum supported Node-RED Version Node v'+nminversion)
                }
            })
        } else {    
            cli.warn('Node version not declared in engines')
        }  
    })
    .then(() => {
        return scorecard
    })
    .catch((e) => {
        cli.error(e);
      });

}

module.exports = checkpackage
