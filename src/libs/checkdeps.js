const os = require('os')
const fs = require('fs');
const p = require('path')
const axios = require('axios')
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
const npmls = require('npm-remote-ls').ls;
//let npmls_config = require('npm-remote-ls').config 
//npmls_config({
//  development: false,
//  optional: false
//})
 
const { resolve } = require('path');
const util = require('util');
const npmCheck = require('npm-check');
const { consumers } = require('stream');
const semver = require('semver');

function checkdeps(path, cli, scorecard, npm_metadata) {
    const package = require(path+'/package.json');
    return new Promise((resolve, reject) => {
        cli.log('    ---Validating Dependencies---')    
        resolve();
      })
    .then(() => {
        // Should have 6 or less dependencies D01
        // 6 is based on the 95th percentile of all packages in catalog at Oct 2021, use https://flows.nodered.org/flow/df33d0171d3d095d7c7b70169b9aa759 to recalculate
        let depcount
        if (package.hasOwnProperty('dependencies')){
            depcount = Object.keys(package.dependencies).length
        } else {
            depcount = 0
        }
    
        if (depcount <= 6) {
            cli.log(`✅ Package has ${depcount} dependencies`)
            scorecard.D01 = {'test' : true}
            scorecard.D01.total = depcount
        } else {
            cli.warn(`D01 Package has a large number of dependencies (${depcount})`)
            scorecard.D01 = {'test' : false}
            scorecard.D01.total = depcount
        }
      })
    .then(() => {
        //Check dependency tree doesn't contain known incompatible packages
        scorecard.D02 = {'test' : true, packages : []}
        if (!package.hasOwnProperty('dependencies')){
            package.dependencies = []
        }
        //return axios.get('https://s3.sammachin.com/badpackages.json') // TODO Move to a node-red domain
        // for now use a local badpacakges file
        return new Promise((resolve, reject) => {
            let response = {}
            response = JSON.parse(fs.readFileSync(__dirname+'/../badpackages.json'));
            resolve(response);
          })
        // end 
        .then(response => {
            const badpackages = response
            for (const [name, version] of Object.entries(package.dependencies)) {
                return new Promise((resolve, reject) => {
                    npmls(name, version, true, function(list) {
                        list.forEach(i => {
                            if (i.indexOf('@') == 0) {
                                n = '@'+i.split('@')[1]
                                v = i.split('@')[2]
                            } else{
                                n = i.split('@')[0]
                                v = i.split('@')[1]
                            }
                            if (Object.keys(badpackages).includes(n) && semver.satisfies(v, badpackages[n])){
                                cli.warn(`D02 Incompatible package ${i} found as dependency of ${name}`)
                                scorecard.D02.test = false
                                scorecard.D02.packages.push(i)
                                //return
                            }           
                        });
                        resolve()
                    });
                })
                }
            
        })
        .then(() => {
            if (scorecard.D02.test) {
                cli.log((`✅ No incompatible packages found in dependency tree`))
                delete scorecard.D02.packages
            }
            return
        }) 
    })
    .then(() => {
        // Check if dependencies are out of date
        scorecard.D03 = {'test' : true, packages : []}
        return npmCheck({cwd: path, skipUnused: true, ignoreDev: true})
           .then(currentState => {
                currentState.get('packages').forEach((dep) => {
                    if (!dep.easyUpgrade){
                        cli.warn(`D03 ${dep.moduleName} is not at latest version, package.json specifies: ${dep.packageJson}, latest is: ${dep.latest}`)
                        scorecard.D03.test = false
                        scorecard.D03.packages.push(dep.moduleName)
                    }
                })
                if (scorecard.D03.test) {
                    cli.log((`✅ All prod dependencies using latest versions`))
                    delete scorecard.D03.packages
                }
            })
    })
    .then(() => {
        return scorecard
    })
    .catch((e) => {
        cli.error(e);
    });

}

module.exports = checkdeps
