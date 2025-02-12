let fs = require('fs');
const moduleJson = JSON.parse(fs.readFileSync('./module.json', 'utf8'));

const output = {
  version: moduleJson.version,
  compatibility: moduleJson.compatibility
};

console.log(JSON.stringify(output));
