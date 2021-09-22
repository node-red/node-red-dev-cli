const axios = require('axios');
const os = require('os')
const fs = require('fs');
const tar = require('tar')

function getFromNPM(package, version) {
  const path = os.tmpdir()+'/'+package
  if (!fs.existsSync(path)){
    fs.mkdirSync(path);
  }
  const tarball = path+'/'+package+'.tgz';
  return axios.get('https://registry.npmjs.org/'+package)
    .then(response => {
        if (version === undefined){
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
                return tar.x({ file: tarball,  cwd: path, sync: false })
                .then(r => {
                  resolve(path+'/package')
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
