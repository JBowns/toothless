#!/usr/bin/env bash

set -e

function create-npm-token() {
  curl -sS -X PUT "http://$NPM_REGISTRY/-/user/org.couchdb.user:abc" \
    -H "accept: application/json" \
    -H "Content-Type: application/json" \
    -d "{ \"_id\": \"org.couchdb.user:abc\", \"name\": \"abc\", \"password\": \"password\", \"type\": \"user\", \"roles\": [] }" |
    jq -r '.token'
}
