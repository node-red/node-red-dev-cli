const acorn = require('acorn');
const walk = require("acorn-walk");
const fs = require("fs");
const axios = require('axios')
const pth = require("path");
const { pathToFileURL } = require('url');
const util = require('util');


function getNodeDefinitions(filename) {
    var regExp = /<script.+?type=['"]text\/javascript['"].*?>([\S\s]*?)<\/script>/ig;
    var content = fs.readFileSync(filename,'utf8');
    // console.error(filename);
    var parts = [];
    var match;
    while((match = regExp.exec(content)) !== null) {
        var block = match[1];
        parts.push(match[1]);
    }
    if (parts.length === 0) {
        throw new Error("No <script> sections found");
    }
    var defs = {};
    var errors = [];
    var count = 0;
    parts.forEach(function(p) {
        try {
            var a = acorn.parse(p,{ecmaVersion: 'latest'});
            // walk.simple(a,{Property(node) { if (node.key.name === 'defaults') console.log(node.value.properties.map(function(n) { return n.key.name})); }})
            walk.simple(a,{
                CallExpression(node) {
                    if (node.callee.property && node.callee.property.name === 'registerType') {
                        var nodeTypeNode = node.arguments[0];
                        var nodeDefNode = node.arguments[1];
                        if (nodeTypeNode.type  === 'Literal') {
                            var defType = nodeTypeNode.value;
                            if (nodeDefNode.type === 'ObjectExpression') {
                                defs[defType] = {};
                                count++;
                                nodeDefNode.properties.forEach(function(nodeDef) {
                                    if (nodeDef.key.name === 'defaults') {
                                        if (!nodeDef.value.properties) {
                                            errors.push({ code:"defaults-not-inline" });
                                        } else {
                                            defs[defType].defaults = {};
                                            nodeDef.value.properties.forEach(function(n) { defs[defType].defaults[n.key.name] = {}; });
                                        }
                                    } else if (nodeDef.key.name === 'credentials') {
                                        if (!nodeDef.value.properties) {
                                            errors.push({ code:"credentials-not-inline" });
                                        } else {
                                            defs[defType].credentials = nodeDef.value.properties.map(function(n) { return n.key.name; });
                                        }
                                    } else if (nodeDef.key.name === 'icon') {
                                        if (nodeDef.value.type === 'Literal') {
                                            defs[defType].icon = nodeDef.value.value;
                                        } else {
                                            errors.push({ code:"icon-not-inline" });
                                        }
                                    } else if (nodeDef.key.name === 'color') {
                                        if (nodeDef.value.type === 'Literal') {
                                            defs[defType].color = nodeDef.value.value;
                                        } else {
                                            errors.push({ code:"color-not-inline" });
                                        }
                                    } else if (nodeDef.key.name === 'inputs') {
                                        if (nodeDef.value.type === 'Literal') {
                                            defs[defType].inputs = nodeDef.value.value;
                                        } else {
                                            errors.push({ code:"inputs-not-inline" });
                                        }
                                    } else if (nodeDef.key.name === 'outputs') {
                                        if (nodeDef.value.type === 'Literal') {
                                            defs[defType].outputs = nodeDef.value.value;
                                        } else {
                                            errors.push({ code:"outputs-not-inline" });
                                        }
                                    } else if (nodeDef.key.name === 'category') {
                                        if (nodeDef.value.type === 'Literal') {
                                            defs[defType].category = nodeDef.value.value;
                                        } else {
                                            errors.push({ code:"category-not-inline" });
                                        }
                                    }
                                });
                            } else {
                                errors.push({
                                    code:"non-objectexpression",
                                    message:util.inspect(nodeDefNode)
                                });
                            }
                        } else {
                            errors.push({
                                code:"non-literal",
                                message:util.inspect(nodeTypeNode)
                            });
                        }
                    }
                }
            });
        } catch(err) {
            //console.log(p);

            errors.push({
                code:"parse",
                message: "at:"+err.pos+" "+p.substr(Math.max(0,err.pos-10),20)
            });
            throw err;
        }
    });
    if (count === 0) {
        if (errors.length > 0) {
            throw new Error("Syntax errors parsing <script>:\n   "+errors.map(function(err) { return err.message; }).join("\n   "));
        }
        throw new Error("No type definitions found");
    }
    return defs;
}


const getAllFiles = function(dirPath, arrayOfFiles) {
  files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(pth.join(dirPath, "/", file))
    }
  })

  return arrayOfFiles
}



function checknodes(path, cli, scorecard, npm_metadata) {
    const package = require(path+'/package.json')
    // Remove the file from the module-cache so if we're being run
    // programmatically we don't cache previous versions
    delete require.cache[require.resolve(path+'/package.json')]

    let defs = {}
    return new Promise((resolve, reject) => {
        cli.log('    ---Validating Nodes---')
        Object.values(package['node-red'].nodes).forEach((n) =>{
            try {
                let htmlfile = path+"/"+n.replace(".js", ".html")
            Object.assign(defs, getNodeDefinitions(htmlfile))
            } catch (error){
                console.log('Unable to parse ',n)
            }
            
        })    
        resolve();
      })
    .then(() => {
        // Nodes SHOULD use unique names N01
        const mynodes = Object.keys(defs)
        scorecard.N01 = {test : true, nodes : []}
        return axios.get('https://catalogue.nodered.org/catalogue.json')
        .then(response => {
            response.data.modules.forEach((m) => {
                m.types.forEach((nodename) => {
                    if (mynodes.includes(nodename) && m.id != package.name){
                        scorecard.N01.test = false
                        scorecard.N01.nodes.push(m.id)
                        cli.warn(`Duplicate nodename ${nodename} found in package ${m.id}`)
                    }
                })
            })
            scorecard.N01.nodes = scorecard.N01.nodes.filter((x, i) => i === scorecard.N01.nodes.indexOf(x))  
        })
        .then(() => {
            if (scorecard.N01.test){
                cli.log('✅ Nodes all have unique names') 
                delete scorecard.N01.nodes
            }
        })
    })
    .then(() => {
        let checknodes = []
        // Example should be provided that uses each node (excluding config nodes)
        new Promise((resolve, reject) => {
            files = []
            if (fs.existsSync(path+'/examples')){
                files = getAllFiles(path+'/examples').filter(x => {if (pth.extname(x) == '.json') {return x}} )
            }
            resolve(files)
        })
        .then((files) => {
            if (files.length != 0){
                Object.keys(defs).forEach((node) => {
                    if (defs[node].category != 'config'){
                        checknodes.push(node)
                    }
                })
                allnodes = [...checknodes]
                files.forEach((file) => {
                    try {
                        let example = JSON.parse(fs.readFileSync(file));
                    example.forEach((n) => {
                        const index = checknodes.indexOf(n.type);
                        if (index > -1) {
                            checknodes.splice(index, 1);
                        }
                    })
                    } catch (error){
                        cli.warn("Unable to read example : "+file)
                    }
                    
                })
                let examplenodes = allnodes.filter(x => !checknodes.includes(x))
                if (checknodes.length != 0){
                    cli.warn(`Examples not found for the following nodes: ${checknodes.join(', ')}`)
                    scorecard.N02 = {test : false}
                    scorecard.N02.nodes = examplenodes
                } else {
                    cli.log('✅ Examples found for all nodes')
                    scorecard.N02 = {test : true}
                    scorecard.N02.nodes = examplenodes
                }
            } else {
                cli.warn('No examples found')
                scorecard.N02 = {test : false}
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
module.exports = checknodes
