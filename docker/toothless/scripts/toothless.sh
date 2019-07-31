#!/usr/bin/env bash

set -e

source github.sh

function init-repository() {
  npm config set registry "http://$NPM_REGISTRY"

  ssh-keyscan -H $GITHUB_HOST >>/root/.ssh/known_hosts

  git clone --verbose git@$GITHUB_HOST:$GITHUB_OWNER/$GITHUB_REPO.git /temp

  cp -r /scaffold /$GITHUB_REPO
  cp -r /temp/.git /$GITHUB_REPO/.git

  ln -s /toothless/bin/cli /$GITHUB_REPO/node_modules/.bin/toothless
  ln -s /toothless/bin/cli /usr/local/bin/toothless

  pushd /$GITHUB_REPO

  git status
  git add --all
  git commit -m "chore(core): initial version"
  git push origin master

  set-success-status

  git checkout -b feature/new-package

  lerna create package-6 --yes

  git add --all
  git commit -m "chore(core): new package"
  git push -u origin feature/new-package

  set-success-status

  git checkout master

  popd
}
