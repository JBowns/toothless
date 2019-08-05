[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

# Toothless
Automate the publishing of your containerised monorepos

> **IMPORTANT:** This tool should **ONLY** be run from within a container, running it outside may adversely alter your machine configuration.

## :bulb: Description
Toothless's goal is to use the best features of `lerna` with more insurance and ultimately confidence should something go wrong, especially when being called in an automated fashion. But **"why not just use lerna directly?"** In many cases it's probably the best approach. However, when developing at scale and on a repository maintaining a feature branching strategy (i.e. a very busy master branch), automation and control shouldn't be underestimated.

### So, what are the key features of Toothless?

#### Extended Verification

Toothless was designed to take a comprehensive look at the repository state, npm profile and GitHub before attempting to make any changes. These checks include but are not limited to

- Verifying the release branch matches that of the upstream.
- The latest commit to be published has passed any GitHub checks.
- The user is capable of pushing to the repository.
- The npm token and profile are both able to publish.

#### Release Branch Lockdown

Toothless takes advantage of GitHubs status api (not to be confused with checks) and branch protection. Before any changes are made Toothless takes a snapshot of the current repository configuration. At which point the new protection model is applied and then rolled back once the publish has successfully completed.

These two features restrict every push going to the release branch and subsequently every PR. Once it's applied we update the status of every open PR with a helpful message telling people a publish is in progress and then for any other subsequent updates.

#### Improved Publish Workflow

Lerna's default publish workflow is as follows

- generate publish commit
- generate release tags
- pushing commit and tags
- publish to npm

Having used this workflow for some time now, should part of the `lerna publish` fail for whatever reason it exposes a number of unfortunate drawbacks.

The first one is choosing to push before publishing to npm. I'm strong believer of favoring operations that **don't** require or **can't** be rollback. That way in the event of an error you don't need to, this also means consistency is easier to achieve when handling errors. Pushing publish commits would ultimately result in a rollback if npm failed for a serious reason, however publishing to npm you neither can, nor need to rollback.

The second is orchestrating the push. Probably due to the additional complexity involved `lerna` choose not to validate that git was capable of pushing to the repository. A number of cases could block pushing a commit to the repository, e.g. the upstream changes. inappropriate permissions and branch protection. However these blocks don't necessarily apply to tags. which means at times I've seen tags pushed to remote while commits are left behind - this all breaks the consistency model.

Now although these two problems aren't difficult to correct, handling them in an automated CI pipeline could cause a number of headaches, more so when applied from ephemeral containers - which is ideally where you want to be publishing from.

## :computer: Usage
The primary command for most cases will be `toothless publish`, however assuming something catastrophic occurs Toothless also gives you the granularity to execute each part of the workflow independently.

### toothless config

Config prints all configuration (**including sensitive data**) gathered from npm, github and git.

### toothless config --verify

This option enables you to ensure the repository is in a valid state before attempting to publish.

### toothless version

This command first verifies the repository state, blocks and then calls `lerna version --yes --no-commit-hooks --no-push` this results in a publish commit and tag being generated.

### toothless push

Pushes the prior commit and tags to remote and subsequently unblocks the repository to allow merges.

### toothless publish

Publish first calls `toothless version` and then proceeds to call `lerna publish from-package` which publishes the packages to npm. Once completed `toothless push` is called to complete the publish process.

### toothless publish --skip-npm-publish

As the name would suggest this command calls `toothless version`, `toothless push` and skips publishing the packages to npm.

## :raising_hand: Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on submitting pull requests to us.

## :scroll: License

[MIT License](./LICENSE.md)
