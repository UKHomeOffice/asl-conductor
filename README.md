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

Install node modules. You should only need to do this once, or when npm dependencies have been modified.

```
npm install
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
you can specify a git ref or timestamp from the [asl-deployments](https://github.com/UKHomeOffice/asl-deployments/commits/master)
repo, and it will attempt to pull the service images which were current then.

To use this feature, you will need a `GITHUB_ACCESS_TOKEN` defined in your env that has read access to the deployments repo.

Using a git ref:

```
npm start -- --ref=<commit hash>
```

Using a datetime:

```
npm start -- --at="2022-09-09 11:26:53"
```

Using just a date (defaults to last commit of the day):

```
npm start -- --at=2022-09-09
```

If there have been schema migrations since that ref, then you should drop the database and elasticsearch first:

```
docker container rm -f asl-conductor-postgres-1 asl-conductor-elasticsearch-1
npm start -- --ref=<commit hash>
npm run seed
```

Note that if you rollback far enough that the conductor config was significantly changed for a service, then all bets are
off and you will probably find that it no-longer works.

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

## Snapshot of postgres container

Sometimes it is helpful to take a snapshot of the database container (or any other container which persists data).

For example, you are debugging an end-to-end test which happens to be the last in its test suite, and relies on data created by 
previous tests in the same suite (this is not good practice for tests, but unfortunately it's an inherited reality).
Because this test relies on the previous tests in the same suite running successfully, this adds the overhead of having to run
all previous tests, in that suite, before getting to the test you are focusing on. In this situation, it would be ideal to 
have a snapshot of the data required by the last test, which corresponds to a snapshot of the database container taken immediately
after all previous tests were executed

### Taking the snapshot

Use `docker commit` command to take a snapshot of the database container while running:
`docker commit <postgres_container_id>  <image_name>:<tag>`

`<image_name>` and `<tag>` are the image name and tag you choose for the to-be generated image 

Example:
`docker commit 36e9ae0c1ac6  aspel/postgres-snapshot:1.0.0`

P.S. To allow data in database to be included in the docker container commit, it was necessary to override 
postgres' `PGDATA` environment variable to a value different from the default `/var/lib/postgresql/data`. In
our case, we used `/var/lib/postgresql/pgdata`


### Using the snapshot

Now you can start a new database container from the image created as a result of the `docker commit` command above. 
Before starting the container from the snapshot image, don't forget to stop the original postgres container and delete it, 
so that the container started from the snapshot can reuse the same container name.
Also remember to pass on environment variables, including the overridden `PGDATA` value

`docker run -d --name postgres -p 127.0.0.1:5432:5432/tcp --network=asl-conductor_asl --env POSTGRES_USER=postgres --env POSTGRES_PASSWORD=test-password --env POSTGRES_DATABASES=asl,asl-test,taskflow,taskflow-test --env PGDATA=/var/lib/postgresql/pgdata --env PORT=5432 aspel/postgres-snapshot:1.0.0`

Note the `--network` setting referring to the same Docker network where other services are already hosted 
so the new container is visible to them.
