const os = require('os')
const fs = require('fs');
const p = require('path')
const axios = require('axios')
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
const npmls = require('npm-remote-ls').ls;
const { resolve } = require('path');
const util = require('util');

const npmlsPromise = util.promisify(npmls);

  

function checkdeps(path, cli, scorecard) {
    const package = require(path+'/package.json');
    scorecard.dependencies = {}
    return new Promise((resolve, reject) => {
        cli.log('---Validating Dependencies---')    
        resolve();
      })
    .then(() => {
        // Should have 6 or less dependencies
        // 6 is based on the 95th percentile of all pacakges in catalog at Oct 2021, use https://flows.nodered.org/flow/df33d0171d3d095d7c7b70169b9aa759 to recalculate
        let depcount = Object.keys(package.dependencies).length
        if (depcount <= 6) {
            cli.log(`✅ Package has ${depcount} dependencies`)
            scorecard.dependencies.count = {'test' : true}
            scorecard.dependencies.count.total = depcount
        } else {
            cli.warn(`Package has a large number of dependencies (${depcount}), are these all needed?`)
            scorecard.dependencies.count = {'test' : false}
            scorecard.dependencies.count.total = depcount
        }
      })
    .then(() => {
        //Check dependency tree doesn't contain known incompatible pacakges
        scorecard.dependencies.badpackages = {'test' : true}
        return axios.get('https://s3.sammachin.com/badpackages.json') // TODO Move to a node-red domain
        .then(response => {
            const badpackages = response.data
            for (const [name, version] of Object.entries(package.dependencies)) {
                console.log(name)
                //return new Promise((resolve, reject) => {
                return npmlsPromise(name, version, true).then((obj) => {
                        console.log(obj)
                        obj.forEach(i => {
                            console.log(i)
                            if (i.indexOf('@') == 0) {
                                n = '@'+i.split('@')[1]
                                v = i.split('@')[2]
                            } else{
                                n = i.split('@')[0]
                                v = i.split('@')[1]
                            }
                            if (Object.keys(badpackages).includes(n) && semver.satisfies(v, badpackages[n])){
                                cli.error(`Incompatible package ${obj} found as dependency of ${name}`)
                                scorecard.dependencies.badpackages.test = false
                            }           
                        });
                    });
            } 
            if (scorecard.dependencies.badpackages.test) {
                cli.log((`✅ No incompatible pacakges found in dependency tree`))
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
