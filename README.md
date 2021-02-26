# conductor

A utility to orchestrate a local cluster of microservices

## Dependencies

This will require `docker-compose` to be installed and on your `$PATH`.

To the best of my knowledge this only works with Docker for Mac because of how it routes to host services.

## Usage

First, create a local `.env` file with the following variables defined:

```
# an arbitrary string
SESSION_SECRET=
# another arbitrary string
JWT_SECRET=
# authentication client parameters
KEYCLOAK_REALM=
KEYCLOAK_URL=
KEYCLOAK_CLIENT=
KEYCLOAK_SECRET=
# AWS SES configuration
EMAIL_FROM_ADDRESS=
EMAIL_ACCESS_KEY=
EMAIL_SECRET=
EMAIL_REGION=
```

To spin up a default stack of all services:

```
npm start
```

To spin up a stack of all but one service so you can run a development version of that locally:

```
npm start -- --local <service-name>
```

_Note: you will need to make sure that the local service is configured to use the docker versions of everything else - i.e. hosts and ports are set to match those in the docker compose config._

To run multiple services locally, simply pass multiple `--local` flags:

```
npm start -- --local <service-name> --local <another-service-name>
```

### Seeding data

To populate the postgres database with dummy development data run `npm run seed`. You should only need to do this once.

## Offline-ish access

Add a `--no-pull` flag to use the last-used image version and _hopefully_ prevent pulling new images from the internet.

## Troubleshooting

This is _very_ hacky, and occasionally things fail because they started up in a funny order.

Try running `docker-compose restart <service>` to kick things if they're not behaving.

### Databases

Postgres will fail silently if it can't expose port 5432 (because you have a local instance running) this will mean that it's possible to have different services running against different databases if you have a local instance running. It's generally better to _only_ use the dockerised postgres instance.

## Options

By default the config will be read from `./conductor.json` and a `docker-compose.yml` file will be written with the generated config. These can be overridden by passing options to the CLI.

```
npm run conductor -- alternative-input.json --out docker-compose-alt.yml
```

`docker-compose` will run detached by default, to run undetached:

```
npm run conductor -- --no-detach
```

## Common dependencies

Running some services with linked dependencies requires a workaround to ensure a single version of certain react components.

A known good set of these dependencies is configured in the package.json and package-lock.json files in the `./common` directory of this repo.

To install copy these into a directory that contains the `asl-*` repo directories and run `npm ci`.