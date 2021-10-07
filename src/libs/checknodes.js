const acorn = require('acorn');
const walk = require("acorn-walk");
const fs = require("fs");
const axios = require('axios')


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
            console.log(p);

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
    if (errors.length > 0) {
        defs.__errors__ = errors;
    }
    return defs;
}

function checknodes(path, cli, scorecard) {
    const package = require(path+'/package.json');
    scorecard.nodes = {}
    return new Promise((resolve, reject) => {
        cli.log('Validating Nodes')
        defs = {}
        Object.values(package['node-red'].nodes).forEach((n) =>{
            let htmlfile = path+"/"+n.replace(".js", ".html")
            Object.assign(defs, getNodeDefinitions(htmlfile))
        })    
        resolve(defs);
      })
    .then((defs) => {
        // Nodes SHOULD use unique names
        const mynodes = Object.keys(defs)
        scorecard.nodes.uniqname = {test : true, nodes : []}
        return axios.get('https://catalogue.nodered.org/catalogue.json')
        .then(response => {
            response.data.modules.forEach((m) => {
                m.types.forEach((nodename) => {
                    if (mynodes.includes(nodename) && m.id != package.name){
                        scorecard.nodes.uniqname.test = false
                        scorecard.nodes.uniqname.nodes.push(m.id)
                        cli.warn(`Duplicate nodename ${nodename} found in package ${m.id}`)
                    }
                })
            })  
        })
        .then(() => {
            if (scorecard.nodes.uniqname.test){
                cli.log('✅ Nodes all have unique names') 
                delete scorecard.nodes.uniqname.nodes
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
