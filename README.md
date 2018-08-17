# conductor

A utility to orchestrate a local cluster of microservices

## Dependencies

This will require `docker-compose` to be installed and on your `$PATH`.

To the best of my knowledge this only works with Docker for Mac because of how it routes to host services.

## Usage

First, create a local `.env` file with the following variables defined:

```
SESSION_SECRET=
KEYCLOAK_REALM=
KEYCLOAK_URL=
KEYCLOAK_CLIENT=
KEYCLOAK_SECRET=
EMAIL_FROM_ADDRESS=
EMAIL_ACCESS_KEY=
EMAIL_SECRET=
EMAIL_REGION=
JWT_SECRET=
```

To spin up a default stack of all services:

```
npm start
```

To spin up a stack of all but one service so you can run a development version of that locally:

```
npm start -- --local <service-name>
```

_Note: you will need to make sure that the local service is configured to use the docker versions of everything else_

### Seeding data

To populate the postgres database with dummy development data run `npm run seed`. You should only need to do this once.

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

To run `docker-compose` detached:

```
npm run conductor -- --detach
```
