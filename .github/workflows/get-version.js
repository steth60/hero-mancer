let fs = require('fs');
const moduleJson = JSON.parse(fs.readFileSync('./module.json', 'utf8'));

console.log(moduleJson.version);
console.log(moduleJson.compatibility.minimum);
console.log(moduleJson.compatibility.verified);
console.log(moduleJson.compatibility.maximum);
