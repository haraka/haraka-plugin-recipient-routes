# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/).

### Unreleased

### [1.3.1] - 2025-06-02

- dep(redis): deleted, depends via h-p-redis

### [1.3.0] - 2025-05-17

- chore: switch URL to use newer syntax
- deps: bump versions

### [1.2.2] - 2025-01-26

- prettier: move config to package.json
- doc: mv Changes.md CHANGELOG.md
- doc(CHANGELOG): fix release tag URLs

### [1.2.1] - 2025-01-07

- style: automated code formatting with prettier
- ci: update local copy of ci.yml
- dep(eslint): updated to v9
- dep: eslint-plugin-haraka -> @haraka/eslint-config
- lint: remove duplicate / stale rules from .eslintrc
- populate [files] in package.json.

### [1.2.0] - 2023-03-29

- maint: replace for..i iterator with for..of, add test
- feat: add redis enabled setting, #28

### [1.1.0] - 2022-11-22

- fix: use this.redis_ping during runtime, #26
- test: more async tests

### 1.0.4 - 2022-11-15

- fix: run redis_ping when registering, fixes #23
- ci: replace travis/appveyor with GHA
- dep(redis): 2 -> 4
- dep(pi-redis): \* -> 2
- dep(eslint): 4 -> 8
- dep(url): drop npm url package, use builtin
- test: replace node_unit with mocha
- doc(README): update badge URLs

### 1.0.3 - 2019-04-11

- test fix for unitialized redis config block

### 1.0.2 - 2018-03-05

- for MX entries, previously only full email address matches in the file were parsed for LMTP/SMTP routes. Now all MX entries are parsed (email file, email domain, email redis, and domain redis) for URIs.
- use es6 arrow functions
- refactored the functions in rcpt() into separate functions (simplify, more testable)

### 1.0.1 - 2017-08-19

- enable Redis install on AppVeyor CI testing

### 1.0.0 - 2017-07-28

- imported from haraka/plugins/rcpt_to.routes

[1.0.3]: https://github.com/haraka/haraka-plugin-recipient-routes/releases/tag/1.0.3
[1.0.4]: https://github.com/haraka/haraka-plugin-recipient-routes/releases/tag/1.0.4
[1.1.0]: https://github.com/haraka/haraka-plugin-recipient-routes/releases/tag/v1.1.0
[1.2.0]: https://github.com/haraka/haraka-plugin-recipient-routes/releases/tag/v1.2.0
[1.2.1]: https://github.com/haraka/haraka-plugin-recipient-routes/releases/tag/v1.2.1
[1.2.2]: https://github.com/haraka/haraka-plugin-recipient-routes/releases/tag/v1.2.2
[1.3.0]: https://github.com/haraka/haraka-plugin-recipient-routes/releases/tag/v1.3.0
[1.3.1]: https://github.com/haraka/haraka-plugin-recipient-routes/releases/tag/v1.3.1
