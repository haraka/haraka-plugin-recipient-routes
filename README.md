# rcpt_to.routes

Recipient Routes does recipient validation and MX routing.

[![Build Status][ci-img]][ci-url]
[![Windows Build Status][ci-win-img]][ci-win-url]
[![Code Climate][clim-img]][clim-url]
[![Greenkeeper badge][gk-img]][gk-url]
[![NPM][npm-img]][npm-url]


## Recipient Validation

Recipients can be listed in the [routes] section of the config file
`config/rcpt_to.routes.ini` or in Redis. If Redis is available, it is checked
first. Then the config file is checked.

Entries can be email addresses or domains. If both are present, email
addresses are favored.

If no route is discovered, recipient processing continues, allowing other
recipient plugins to vouch for the recipient. If none does, the recipient is
rejected.

### Order of Recipient Search

1. Redis email
2. Redis domain
3. File email
4. File domain

## MX Routing

NOTE: MX routing by default routes *only* based on domains. To route for email
addresses, you must set the preference `always_split=true` in
'config/outbound.ini'.

Each entry in the [routes] section of `config/rcpt_to.routes.ini` or in Redis
must specify a MX record. The MX record is the same format as _outbound.js_.
Examples:

    * hostname
    * hostname:port
    * ipaddress
    * ipaddress:port
    * { priority: 0, exchange: hostname, port: 25 }

## Configuration

The following options can be specified in `config/rcpt_to.routes.ini`:

### Redis

The [redis] section has three optional settings (defaults shown):

    [redis]
    host=127.0.0.1
    port=6379
    db=0

### Routes

The [routes] section can include routes for domains and email addresses:

    [routes]
    example.com=mail.example.com:225
    matt@example.com=some.where.com
    spam@example.com=honeybucket.where.com:26

You may also use URI format to specify SMTP vs LMTP:

    [routes]
    aaron@example.com=lmtp://mail.example.com:2525
    matt@example.com=smtp://127.0.0.1:4242

# Performance

## File based

Routes from the config file are loaded into an object at server startup. If
the config file changes, the routes automatically update. Key lookups in the
object are extremely fast. In 2014, the author measured 450,000 qps against
a 92,000 key object on a Xeon E5-2620 @ 2.10GHz.

## Redis

The benchmarks published by the author(s) of the Node 'redis' module are
about 30,000 qps.

# Author

Matt Simerson.

Underwritten and graciously donated to the Haraka community
by [Serious Mumbo, Inc.](http://seriousmumbo.com)


<!-- leave these buried at the bottom of the document -->
[ci-img]: https://travis-ci.org/haraka/haraka-plugin-recipient-routes.svg
[ci-url]: https://travis-ci.org/haraka/haraka-plugin-recipient-routes
[ci-win-img]: https://ci.appveyor.com/api/projects/status/9vhq04hbiaesc46o?svg=true
[ci-win-url]: https://ci.appveyor.com/project/msimerson/haraka-plugin-recipient-routes
[cov-img]: https://codecov.io/github/haraka/haraka-plugin-recipient-routes/coverage.svg
[cov-url]: https://codecov.io/github/haraka/haraka-plugin-recipient-routes
[clim-img]: https://codeclimate.com/github/haraka/haraka-plugin-recipient-routes/badges/gpa.svg
[clim-url]: https://codeclimate.com/github/haraka/haraka-plugin-recipient-routes
[gk-img]: https://badges.greenkeeper.io/haraka/haraka-plugin-recipient-routes.svg
[gk-url]: https://greenkeeper.io/
[npm-img]: https://nodei.co/npm/haraka-plugin-recipient-routes.png
[npm-url]: https://www.npmjs.com/package/haraka-plugin-recipient-routes

