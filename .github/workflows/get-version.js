let fs = require('fs');
const moduleJson = JSON.parse(fs.readFileSync('./module.json', 'utf8'));

console.log(
  JSON.stringify({
    version: moduleJson.version,
    compat_min: moduleJson.compatibility.minimum,
    compat_verified: moduleJson.compatibility.verified,
    compat_max: moduleJson.compatibility.maximum
  })
);
