const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const fetch = require('r2');
const dotenv = require('dotenv');
const mustache = require('mustache');
const { keyBy } = require('lodash');

mustache.escape = text => text;

module.exports = (settings, args) => {

  const normalise = service => {
    console.log(`Configuring service: ${service.name}`);
    service.links = service.links || [];
    if (args.local === service.name) {
      service.local = true;
      service.host = 'host.docker.internal';
    } else {
      service.host = service.name;
    }
    service.env = service.env || {};
    if (service.port) {
      service.env.PORT = service.port;
    }
    return { ...service };
  }

  const getImage = service => {
    if (!service.image) {
      return fetch(`https://quay.io/api/v1/repository/ukhomeofficedigital/${service.name}/tag`).json
        .then(response => Object.values(response.tags))
        .then(tags => tags[0])
        .then(tag => `quay.io/ukhomeofficedigital/${service.name}:${tag.name}`)
        .then(image => {
          return { ...service, image };
        });
    }
    return { ...service };
  };

  const getEnv = (service, i, all) => {
    const services = keyBy(all, 'name');
    const local = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), args.env)));
    const env = Object.keys(service.env || {}).map(key => {
      const value = typeof service.env[key] === 'string'
        ? mustache.render(service.env[key], { env: local, services })
        : service.env[key];
      return { key, value };
    });
    return { ...service, env };
  };

  const getLinks = (service, i, all) => {
    service.links = service.links.filter(link => link !== args.local);
    return { ...service };
  };

  return Promise.resolve(settings.services)
    .then(services => Promise.all(services.map(normalise)))
    .then(services => Promise.all(services.map(getImage)))
    .then(services => Promise.all(services.map(getEnv)))
    .then(services => Promise.all(services.map(getLinks)))
    .then(services => services.filter(s => !s.local))
    .then(services => {
      const tpl = fs.readFileSync(path.resolve(__dirname, '../template/docker-compose.tpl.yml')).toString();
      return mustache.render(tpl, { services });
    })
    .then(yml => {
      const output = path.resolve(process.cwd(), args.out);
      fs.writeFileSync(output, yml);
      return output;
    })
    .then(file => {
      spawn('docker-compose', ['-f', file, 'up'], { stdio: 'inherit' });
    });

};
