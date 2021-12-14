const os = require('os')
const fs = require('fs');
const { t } = require('tar');
const semver = require('semver');
const p = require('path')
//const nodegit = require('nodegit');
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
    return new Promise((resolve, reject) => {
        cli.log('    ---Validating Package---')
        cli.log(`   ${package.name}@${package.version}`)  
        scorecard.package = {'name' : package.name, 'version' : package.version}  
        resolve();
      })
    .then(() => {
        //MUST Have a License P01
        if (package.hasOwnProperty('license')){
            cli.log(`✅ Package is ${package.license} licensed`)
            scorecard.P01 = {'test' : true, 'license' : package.license}
        } else {
            cli.error('No License Specified')
            scorecard.P01 = {'test' : false}
        }
      })
      .then(() => {
        //MUST Have Repository or Bugs url/email P03
        if (package.hasOwnProperty('repository') || package.hasOwnProperty('bugs')){
            cli.log(`✅ Repository/Bugs Link Supplied`)
            scorecard.P03 = {'test' : true}
        } else {
            cli.warn('P03 Please provide either a repository URL or a Bugs URL/Email')
            scorecard.P03 = {'test' : false}
        }
      })
    // Test P02 Disabled pending a more effieint method than nodegit  
    //.then(() => {
    //     // Check package in repository is the same name as the package.json (check for forks) - This may need more thought and testing P02
    //    if (package.hasOwnProperty('repository')){
    //        let repourl = package.repository.url
    //        let repo = p.basename(repourl)
    //        const repopath = os.tmpdir()+'/'+repo
    //        if (!fs.existsSync(repopath)){
    //            fs.mkdirSync(repopath);
    //        } else{
    //            fs.rmSync(repopath+'/', { recursive:true })
    //        }
    //        //Fix for repourls that contain credentials eg 'git@github.com:username/project.git'
    //        if (repourl.indexOf('@') != -1){ repourl = 'https://'+repourl.replace(':', '/').split('@')[1]}
    //       if (!isGitUrl(repourl)){
    //            cli.error('Invalid Repository URL: '+ repourl)
    //        }
    //        return nodegit.Clone(repourl, repopath)
    //        .then(function (r){
    //            if (package.repository.hasOwnProperty('directory')){
    //                let path = r.workdir()+package.repository.directory
    //            } else{
    //                let path = r.workdir()
    //            }
    //            let repopackage = require(path+'/package.json')
    //            if (package.name != repopackage.name){
    //                cli.warn('P02 Package name does not match package.json in repository')
    //                scorecard.P02 = {'test' : false}
    //            } else {
    //                cli.log('✅ Package Name Matches Repository')
    //                scorecard.P02 = {'test' : true}
    //            }
    //        })
    //        .catch((e) =>{
    //            cli.error('P02 Failed to clone git repository '+e)
    //            scorecard.P02 = {'test' : false}
    //        })
    //    } else {
    //        cli.warn('P02 No Repository listed in package.json')
    //        scorecard.P02 = {'test' : false}
    //    }
    //})
    .then(() => {
        // P04 Naming
        let legacy = false
        const scopedRegex = new RegExp('@[a-z\\d][\\w-.]+/[a-z\\d][\\w-.]*');
        if (npm_metadata){
            //New packages should Use a Scoped name
            let scoped_start= Date.parse('2022-02-01T00:00:00.000Z') //New Packages should use scoped names from 1st Feb 2021
            let created = Date.parse(npm_metadata.time.created)
            if (created<scoped_start){
                legacy = true
            }
        }
        if (!legacy){
            if (scopedRegex.test(package.name)){
                cli.log('✅ Package uses a Scoped Name')
                scorecard.P04 = { 'test' : true}
            } else {
                cli.warn('P04 New Packages should use a scoped name')
                scorecard.P04 = { 'test' : false}
            }    
        }
        if (!scopedRegex.test(package.name)) {
            const contribRegex = new RegExp('/^(node-red|nodered)(?!-contrib-).*/ig')
            if (contribRegex.test(package.name)){
                cli.warn('P04 Packages using the node-red prefix in their name must use node-red-contrib')
                scorecard.P04 = { 'test' : false}
            } else {
                cli.log('✅ Package uses a valid name')
                scorecard.P04 = { 'test' : true}
            }


        }         
    })
    .then(() => {
        //Check for other package of same name in different scope, ask about fork? P08
        scorecard.P08 = {test : true}
        const name = package.name.split('/').slice(-1) // Package name without scope
        let similar = false
        let similarlist = []
        return axios.get('https://catalogue.nodered.org/catalogue.json')
        .then(response => {               
            response.data.modules.forEach((m) => {
                if (name.includes(m.id.split('/').slice(-1))){
                    cli.warn(`P08 Similar named package found at ${m.id}`)
                    similar = true
                    similarlist.push(m.id)
                }
            })
            if (similar){
                scorecard.P08 = { 'test' : false, 'similar': similarlist}
            } else {
                cli.log('✅ No similar named packages found')
                scorecard.P08 = { 'test' : true}
            }
            return similar
        })
        scorecard.P08.test = !test
    })
    .then(() => {
       //MUST have Node-RED in keywords P05
    if (package.hasOwnProperty('keywords') && package.keywords.includes('node-red')){
        cli.log(`✅ Node-RED Keyword Found`)
        scorecard.P05 = { 'test' : true}
    } else {
        cli.warn('P05 Package.json keywords MUST contain node-red')
        scorecard.P05 = { 'test' : true}
    }   
    })
    .then(() => {
      //SHOULD declare min node-red version in node-red P06
        if (package['node-red'].hasOwnProperty('version')){
            return axios.get('https://registry.npmjs.org/node-red')
            .then(response => {
            let tags = response.data['dist-tags']
            let supportedRegex = new RegExp('.*maintenance.*|^latest$') // check which versions have a latest or maintenance tag
            let versions = []
            Object.keys(tags).forEach(t => {
	            if (supportedRegex.test(t)) {
    		        versions.push(tags[t])
	            }
            });
            //Test version against current versions
            let compatible = false
            let cv = []
            versions.forEach(v  => {
                if (semver.satisfies(v, package['node-red'].version)){
                    cli.log(`✅ Compatible with Node-RED v${v}`)
                    compatible = true
                    scorecard.P06 = { 'test' : true}
                    cv.push(v)
                } else {
                    cli.warn(`P06 NOT Compatible with Node-RED v${v}`)
                }
                if (!compatible){
                    cli.warn('P06 Not Compatible with any current Node-RED versions')
                    scorecard.P06 = { 'test' : false}
                } else {
                    scorecard.P06.versions = cv
                }
            })
        })
        } else {
            cli.warn('P06 Node-RED version compatibility not declared')
            scorecard.P06 = { 'test' : false}
        }    
    })
    .then(() => {
        //SHOULD declare min node version in engines P07
        if ( package.hasOwnProperty('engines') && package.engines.hasOwnProperty('node')){
            return axios.get('https://registry.npmjs.org/node-red')
            .then(response => {               
                nminversion = semver.minVersion(response.data.versions[response.data["dist-tags"].latest].engines.node)
                if  (semver.satisfies(nminversion, package.engines.node)){
                    cli.log(`✅ Compatible NodeJS Version found ${nminversion}`)
                    scorecard.P07 = { 'test' : true}
                    scorecard.P07.version = package.engines.node
                } else {
                    cli.warn('P07 Minimum Node version is not compatible with minimum supported Node-RED Version Node v'+nminversion)
                    scorecard.P07 = { 'test' : fail}
                    scorecard.P07.version = package.engines.node
                }
            })
        } else {    
            cli.warn('P07 Node version not declared in engines')
            scorecard.P07 = { 'test' :false}
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
