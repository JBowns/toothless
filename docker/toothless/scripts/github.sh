#!/usr/bin/env bash

set -e

function create-repository() {
  echo "Creating GitHub repository '$GITHUB_REPO' for owner '$GITHUB_OWNER'"
  curl --fail -X POST \
    "https://api.github.com/user/repos" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -d "{ \"owner\": \"$GITHUB_OWNER\", \"name\": \"$GITHUB_REPO\", \"description\": \"testing $GITHUB_REPO\", \"private\": true }"

  echo "Adding deploy key to GitHub repository '$GITHUB_REPO'"

  local PUBLIC_KEY=$(cat /root/.ssh/id_rsa.pub)
  curl --fail -X POST \
    "https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO/keys" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -d "{ \"title\": \"key\", \"key\": \"$PUBLIC_KEY\", \"read_only\": false }"
}

function add-branch-protection() {
  echo "Adding branch '$GIT_RELEASE_BRANCH' protection to GitHub repository '$GITHUB_REPO'"
  curl --fail -X PUT \
    "https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO/branches/$GIT_RELEASE_BRANCH/protection" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.luke-cage-preview+json" \
    -d @- <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["continuous-integration"]
  },
  "enforce_admins": null,
  "required_pull_request_reviews": null,
  "restrictions": null
}
EOF
}

function set-success-status() {
  local COMMIT_SHA="$(git rev-parse HEAD)"
  echo "Setting success status for commit '$COMMIT_SHA'"
  curl --fail -X POST \
    "https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO/statuses/$COMMIT_SHA" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -d @- <<EOF
{
  "state": "success",
  "context": "continuous-integration"
}
EOF
}

function create-pull-request() {

  echo "Creating pull request for branch 'feature/new-package'"
  curl --fail -X POST \
    "https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO/pulls" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -d @- <<EOF
{
  "title": "Amazing new feature",
  "body": "Please pull this in!",
  "head": "feature/new-package",
  "base": "master"
}
EOF
}
