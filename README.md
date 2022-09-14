# conductor

A utility to orchestrate a local cluster of microservices

## Dependencies

This will require `docker-compose` to be installed and on your `$PATH`.

To the best of my knowledge this only works with Docker for Mac because of how it routes to host services.

## Usage

First, create a local `.env` file with the following variables defined:

```
# secret for the asl-dev-connect keycloak OAuth client
KEYCLOAK_SECRET=

# asl-resolver keycloak password
KEYCLOAK_PASSWORD=

# bot-data-exports keycloak password
KC_EXPORTS_PASSWORD=

# arbitrary 32 character hex string
TRANSPORT_KEY=
# arbitrary 16 character hex string
TRANSPORT_IV=
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

## Seeding data

To populate the postgres database with dummy development data run `npm run seed`. You should only need to do this once.

## Offline-ish access

Add a `--no-pull` flag to use the last-used image version and _hopefully_ prevent pulling new images from the internet.

## Rolling back to an older stack

By default, Conductor will attempt to pull the latest images for each service. To run a stack from an earlier point in time,
you can specify a git ref from the [asl-deployments](https://github.com/UKHomeOffice/asl-deployments/commits/master) repo,
and it will attempt to pull the service images which were current at that specific commit.

To use this feature, you will need a `GITHUB_ACCESS_TOKEN` defined in your env that has read access to the deployments repo.

```
npm start -- --ref=<commit hash>
```

If there has been / could have been schema migrations since that ref, then you should drop the database and elasticsearch first:

```
docker container rm -f asl-conductor-postgres-1 asl-conductor-elasticsearch-1
npm start -- --ref=<commit hash>
npm run seed
```

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
