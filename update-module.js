import { readFile, writeFile } from 'fs';
import { join } from 'path';

const version = process.argv[2];

if (!version) {
  console.error('No version specified');
  process.exit(1);
}

const moduleJsonPath = join(__dirname, 'module.json');

readFile(moduleJsonPath, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading module.json: ${err}`);
    return;
  }

  let moduleJson;
  try {
    moduleJson = JSON.parse(data);
  } catch (err) {
    console.error(`Error parsing module.json: ${err}`);
    return;
  }

  moduleJson.version = version;
  moduleJson.manifest = `https://github.com/Sayshal/hero-mancer/releases/latest/download/module.json`;
  moduleJson.download = `https://github.com/Sayshal/hero-mancer/releases/download/${version}/module.zip`;

  writeFile(moduleJsonPath, JSON.stringify(moduleJson, null, 2), 'utf8', (err) => {
    if (err) {
      console.error(`Error writing module.json: ${err}`);
      return;
    }

    console.log(`module.json successfully updated to version ${version}`);
  });
});
