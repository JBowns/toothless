#!/usr/bin/env bash

set -e

lerna exec 'npm unpublish --force'

git push origin --delete $(git tag --list)
git tag --delete $(git tag --list)
git reset --hard $(git rev-list --max-parents=0 --abbrev-commit HEAD)
git push --force --follow-tags origin master
