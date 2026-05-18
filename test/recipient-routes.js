'use strict'

const assert = require('node:assert')
const path = require('node:path')
const { afterEach, beforeEach, describe, it } = require('node:test')

const { Address } = require('@haraka/email-address')
const fixtures = require('haraka-test-fixtures')

const hmail = {
  todo: {
    queue_time: 1402091363826,
    domain: 'example.com',
    rcpt_to: [new Address('matt@example.com')],
    mail_from: new Address('<>'),
    notes: {
      authentication_results: ['spf=pass smtp.mailfrom=example.net'],
      spf_mail_result: 'Pass',
      local_sender: true,
    },
    uuid: 'DFB28F2B-CC21-438B-864D-934E6860AB61.1',
  },
}

let server, plugin, connection

const file_setup = () => {
  server = {}
  plugin = new fixtures.plugin('index')
  plugin.config = plugin.config.module_config(path.resolve('test'))

  plugin.register()
  connection = fixtures.connection.createConnection()
  connection.init_transaction()
}

const redis_setup = (t, done) => {
  server = { notes: {} }

  plugin = new fixtures.plugin('index')
  plugin.register()

  connection = fixtures.connection.createConnection()
  connection.init_transaction()

  if (plugin.redisCfg.opts === undefined) plugin.redisCfg.opts = {}
  plugin.redisCfg.opts.retry_strategy = function () {
    return
  }

  plugin.init_redis_plugin((err) => {
    if (err) console.error(err.message)
    done()
  }, server)
}

describe('haraka-plugin-recipient-routes', () => {
  describe('rcpt file', () => {
    beforeEach(file_setup)

    it('miss returns undefined on null', async () => {
      await new Promise((resolve) => {
        plugin.rcpt(
          function (rc, msg) {
            assert.equal(rc, undefined)
            assert.equal(msg, undefined)
            resolve()
          },
          connection,
          [new Address('<miss@example.com>')],
        )
      })
    })

    it('hit returns OK', async () => {
      await new Promise((resolve) => {
        plugin.rcpt(
          function (rc, msg) {
            assert.equal(rc, OK)
            assert.equal(msg, undefined)
            resolve()
          },
          connection,
          [new Address('<matt@example.com>')],
        )
      })
    })

    it('missing domain', () => {
      try {
        plugin.rcpt(
          function () {
            assert.ok(false)
          },
          connection,
          [new Address('<matt>')],
        )
      } catch (ignore) {
        // console.error(ignore)
        // an error is expected
      }
    })

    it('lowers mixed case routes', () => {
      assert.deepEqual(plugin.route_list, {
        'bad@example.com': '127.0.0.1:26',
        'matt@example.com': '192.168.76.66',
        'mixed@example.com': '172.16.1.1',
      })
    })
  })

  describe('rcpt redis', () => {
    beforeEach(redis_setup)

    afterEach(() => {
      plugin.delete_route('matt@example.com')
      plugin.db.quit()
    })

    it('miss returns undefined on null', (t, done) => {
      const addr = new Address('<matt@example.com>')
      plugin.redis_ping().then((v) => {
        if (!v) {
          console.error('ERROR: no redis available!')
          return done()
        }

        plugin.delete_route(addr.address)
        plugin.rcpt(
          (rc, msg) => {
            assert.equal(rc, undefined)
            assert.equal(msg, undefined)
            done()
          },
          connection,
          [addr],
        )
      })
    })

    it('hit returns OK', (t, done) => {
      plugin.redis_ping().then((v) => {
        if (!v) return done()

        const addr = new Address('<matt@example.com>')
        plugin.insert_route(addr.address, '192.168.2.1')
        plugin.rcpt(
          (rc, msg) => {
            assert.equal(rc, OK)
            assert.equal(msg, undefined)
            done()
          },
          connection,
          [addr],
        )
      })
    })
  })

  describe('get_mx file', () => {
    beforeEach(file_setup)

    it('email address file hit', async () => {
      plugin.route_list = { 'matt@example.com': '192.168.1.1' }
      const addr = new Address('<matt@example.com>')
      await new Promise((resolve) => {
        plugin.get_mx(
          (rc, mx) => {
            assert.equal(rc, OK)
            assert.equal(mx, '192.168.1.1')
            resolve()
          },
          hmail,
          addr.host,
        )
      })
    })

    it('email domain file hit', async () => {
      plugin.route_list = { 'example.com': '192.168.1.2' }
      const addr = new Address('<matt@example.com>')
      await new Promise((resolve) => {
        plugin.get_mx(
          (rc, mx) => {
            assert.equal(rc, OK)
            assert.equal(mx, '192.168.1.2')
            resolve()
          },
          hmail,
          addr.host,
        )
      })
    })

    it('address preferred file', async () => {
      plugin.route_list = {
        'matt@example.com': '192.168.1.1',
        'example.com': '192.168.1.2',
      }
      const addr = new Address('<matt@example.com>')
      await new Promise((resolve) => {
        plugin.get_mx(
          (rc, mx) => {
            assert.equal(rc, OK)
            assert.equal(mx, '192.168.1.1')
            resolve()
          },
          hmail,
          addr.host,
        )
      })
    })
  })

  describe('get_mx redis', () => {
    beforeEach(redis_setup)

    afterEach(() => {
      plugin.delete_route('matt@example.com')
      plugin.db.quit()
    })

    it('email address redis hit', (t, done) => {
      plugin.redis_ping().then((v) => {
        if (!v) return done()

        const addr = new Address('<matt@example.com>')
        plugin.insert_route('matt@example.com', '192.168.2.1')
        plugin.get_mx(
          (rc, mx) => {
            assert.equal(rc, OK)
            assert.equal(mx, '192.168.2.1')
            plugin.delete_route(addr.address)
            done()
          },
          hmail,
          addr.host,
        )
      })
    })

    it('email domain redis hit', (t, done) => {
      plugin.redis_ping().then((v) => {
        if (!v) return done()

        const addr = new Address('<matt@example.com>')
        plugin.insert_route(addr.address, '192.168.2.2')
        plugin.get_mx(
          (rc, mx) => {
            assert.equal(rc, OK)
            assert.equal(mx, '192.168.2.2')
            plugin.delete_route(addr.address)
            done()
          },
          hmail,
          addr.host,
        )
      })
    })

    it('address preferred redis', (t, done) => {
      plugin.redis_ping().then((v) => {
        if (!v) return done()

        plugin.insert_route('matt@example.com', '192.168.2.1')
        plugin.insert_route('example.com', '192.168.2.2')
        const addr = new Address('<matt@example.com>')

        plugin.get_mx(
          (rc, mx) => {
            assert.equal(rc, OK)
            assert.equal(mx, '192.168.2.1')
            plugin.delete_route('matt@example.com')
            plugin.delete_route('example.com')
            done()
          },
          hmail,
          addr.host,
        )
      })
    })
  })
})
