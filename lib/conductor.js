const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Octokit } = require('@octokit/rest');
const YAML = require('yaml');

const fetch = require('r2');
const dotenv = require('dotenv');
const mustache = require('mustache');
const moment = require('moment');
const { keyBy, get, isEmpty } = require('lodash');
const ImageCache = require('./image-cache');
let versions = {};

mustache.escape = text => text;

module.exports = (settings, args) => {

  const normalise = service => {
    console.log(`Configuring service: ${service.name}`);
    service.port = service.port || settings.ports[service.name];
    if (args.local.includes(service.name)) {
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
  };

  const getLatestTag = name => {
    return fetch(`https://quay.io/api/v1/repository/ukhomeofficedigital/${name}/tag`).json
      .then(response => Object.values(response.tags))
      .then(tags => tags[0]);
  };

  const fetchVersionsAtRef = async ref => {
    if (!process.env.GITHUB_ACCESS_TOKEN) {
      throw new Error('GITHUB_ACCESS_TOKEN with read permission for asl-deployments is required');
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_ACCESS_TOKEN, userAgent: 'asl-conductor' });
    const response = await octokit.repos.getContent({
      owner: 'UKHomeOffice',
      repo: 'asl-deployments',
      path: 'versions.yml',
      ref
    });

    if (!get(response, 'data.content')) {
      throw new Error(`Could not retrieve versions.yml from asl-deployments at ref: ${ref}`);
    }

    const content = Buffer.from(response.data.content, 'base64').toString('utf-8').trim();
    const versions = YAML.parse(content);
    versions['html-pdf-converter'] = versions['pdf-generator']; // handle different naming in deployments/conductor

    console.log(`WARNING: USING POTENTIALLY OUT OF DATE VERSIONS (${ref})`);
    return versions;
  };

  const fetchVersionsAtDate = async date => {
    if (!process.env.GITHUB_ACCESS_TOKEN) {
      throw new Error('GITHUB_ACCESS_TOKEN with read permission for asl-deployments is required');
    }

    const until = moment(date);

    if (!until.isValid()) {
      throw new Error(`invalid date: ${date}`);
    }

    if (!until.creationData().format.includes('HH:mm:ss')) {
      until.endOf('day'); // set end of day if no time specified
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_ACCESS_TOKEN, userAgent: 'asl-conductor' });

    const response = await octokit.repos.listCommits({
      owner: 'UKHomeOffice',
      repo: 'asl-deployments',
      until: until.toISOString(),
      per_page: 1
    });

    const ref = get(response, 'data[0].sha');

    if (!ref) {
      throw new Error(`Could not retrieve versions.yml from asl-deployments at date: ${until.toISOString()}`);
    }

    return fetchVersionsAtRef(ref);
  };

  const getVersions = async services => {
    if (args.ref) {
      versions = await fetchVersionsAtRef(args.ref);
    } else if (args.at) {
      versions = await fetchVersionsAtDate(args.at);
    }
    if (!isEmpty(versions)) {
      console.log(versions);
    }
    return services;
  };

  const getImage = async service => {
    if (args.ref && !service.build && (!service.image || service.image.includes('quay.io'))) {
      const imageName = service.image ? service.image.split('/').pop() : service.name;
      // if a service did not exist at the time of this ref, then just install the latest service as it won't be used anyway
      const tag = versions[imageName] || (await getLatestTag(imageName)).name;
      const image = `quay.io/ukhomeofficedigital/${imageName}:${tag}`;
      await ImageCache.write(service.name, image);
      return { ...service, image };
    }
    if (service.image && service.image !== service.name && !service.image.includes(':')) {
      const imageName = service.image.split('/').pop();
      return getLatestTag(imageName)
        .then(tag => tag && `${service.image}:${tag.name}`)
        .then(image => {
          return ImageCache.write(service.name, image)
            .then(() => {
              return { ...service, image };
            });
        });
    }
    if (args.pull && !service.image && !service.build) {
      return getLatestTag(service.name)
        .then(tag => tag && `quay.io/ukhomeofficedigital/${service.name}:${tag.name}`)
        .then(image => {
          return ImageCache.write(service.name, image)
            .then(() => {
              return { ...service, image };
            });
        });
    } else if (!service.image && !service.build) {
      return ImageCache.read(service.name)
        .then(image => {
          return { ...service, image };
        });
    }
    return { ...service };
  };

  const getEnv = (service, i, all) => {
    const services = keyBy(all, 'name');
    const local = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), args.env)));
    const configured = settings.env;
    const env = Object.keys(service.env || {}).map(key => {
      const value = typeof service.env[key] === 'string'
        ? mustache.render(service.env[key], { env: Object.assign(local, configured), services })
        : service.env[key];
      return { key, value };
    });
    return { ...service, env };
  };

  const getRunCommands = (service, i, all) => {
    const services = keyBy(all, 'name');
    const local = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), args.env)));
    const configured = settings.env;
    if (service.run) {
      service.run = mustache.render(service.run, { env: Object.assign(local, configured), services });
    }
    return { ...service };
  };

  return Promise.resolve(settings.services)
    .then(services => getVersions(services))
    .then(services => Promise.all(services.map(normalise)))
    .then(services => Promise.all(services.map(getImage)))
    .then(services => Promise.all(services.map(getEnv)))
    .then(services => Promise.all(services.map(getRunCommands)))
    .then(services => services.filter(s => !s.local))
    .then(services => {
      const tpl = fs.readFileSync(path.resolve(__dirname, '../template/docker-compose.mustache')).toString();
      return mustache.render(tpl, { services });
    })
    .then(yml => {
      const output = path.resolve(process.cwd(), args.out);
      fs.writeFileSync(output, yml);
      return output;
    })
    .then(file => {
      const opts = ['-f', file, 'up', '--remove-orphans'];
      if (args.detach !== false) {
        opts.push('-d');
      }
      spawn('docker-compose', opts, { stdio: 'inherit' });
    });

};
