const path = require('path');
const fs = require('fs');

const file = path.resolve(process.cwd(), '.images.json');

const readFile = () => {
  return Promise.resolve()
    .then(() => fs.readFileSync(file))
    .then(json => JSON.parse(json))
    .catch(e => ({}));
};

const writeFile = list => {
  return Promise.resolve()
    .then(() => JSON.stringify(list, null, '  '))
    .then(json => fs.writeFileSync(file, json));
};

module.exports = {

  read: service => {
    return Promise.resolve()
      .then(() => readFile())
      .then(json => json[service])
      .then(image => {
        if (!image) {
          throw new Error(`No cached image available for service: ${service}`);
        }
        return image;
      });
  },

  write: (service, image) => {
    return Promise.resolve()
      .then(() => readFile())
      .then(json => ({ ...json, [service]: image }))
      .then(json => writeFile(json));
  }

};
