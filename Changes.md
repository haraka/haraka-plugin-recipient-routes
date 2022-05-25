
### 1.0.4 - 2022-05-24

- dep(redis): 2 -> 4
- dep(pi-redis): * -> 2
- dep(eslint): 4 -> 8
- dep(url): drop npm url package, use builtin
- test: node_unit -> mocha
- ci: replace travis/appveyor with GHA
- ci(cov): replace nyc with c8


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
