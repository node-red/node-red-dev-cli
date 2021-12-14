const axios = require('axios');
const os = require('os')
const fs = require('fs');
const tar = require('tar')

function getFromNPM(package, version) {
  const path = os.tmpdir()+'/'+package
  let npm_metadata = false
  if (!fs.existsSync(path)){
    if (package.substr(0,1) === '@'){
      fs.mkdirSync(os.tmpdir()+'/'+package.split('/')[0]);
      fs.mkdirSync(os.tmpdir()+'/'+package);
    } else {
      fs.mkdirSync(path);
    }
  }
  const tarball = path+'/package.tgz';
  return axios.get('https://registry.npmjs.org/'+package)
    .then(response => {
        npm_metadata = response.data
        if (!version){
            version = response.data['dist-tags'].latest
        }
        var tarballUrl = response.data.versions[version].dist.tarball;
        return axios({
            method: 'get',
            url: tarballUrl,
            responseType: 'arraybuffer',
        })
        .then(response => {
          return new Promise(function(resolve, reject) {
            fs.writeFile(tarball, response.data, function(err) {
              if (err) reject(err);
              else {
                return tar.x({ file: tarball,  cwd: path, sync: false, strip: 1 })
                .then(r => {
                  resolve([path, npm_metadata])
                })
              }                     
            });
          })
          
        });
    })
  .catch(error => {
    console.log(error);
  });
}

module.exports = getFromNPM
