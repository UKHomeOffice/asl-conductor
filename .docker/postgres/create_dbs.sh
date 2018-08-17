#!/bin/bash
set -e
set -u

function create_database() {
  local database=$1
  echo " Creating database '$database'"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE "$database";
EOSQL
}

if [ -n "$POSTGRES_DATABASES" ]; then
  echo "Multiple database creation requested: $POSTGRES_DATABASES"
  for db in $(echo $POSTGRES_DATABASES | tr ',' ' '); do
    create_database $db
  done
  echo "All databases created"
fi
