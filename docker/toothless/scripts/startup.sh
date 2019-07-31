#!/usr/bin/env bash

set -e

function cleanup() {
  rm -rf /root/.npm/token
  rm -rf /root/.ssh/id_rsa
  rm -rf /root/.ssh/id_rsa.pub
  rm -rf /root/.ssh/known_hosts
}

source github.sh
source verdaccio.sh
source toothless.sh

create-repository
init-repository
add-branch-protection
create-pull-request

export GITHUB_KEY=$(cat /root/.ssh/id_rsa)
export NPM_TOKEN=$(create-npm-token)

cleanup

cd /$GITHUB_REPO

$@
