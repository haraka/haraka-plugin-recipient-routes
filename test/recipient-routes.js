'use strict'

const assert = require('node:assert')
const path = require('node:path')

const Address = require('address-rfc2821').Address
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

function file_setup() {
  this.server = {}
  this.plugin = new fixtures.plugin('index')
  this.plugin.config = this.plugin.config.module_config(path.resolve('test'))

  this.plugin.register()
  this.connection = fixtures.connection.createConnection()
  this.connection.init_transaction()

}

function redis_setup(done) {
  this.server = { notes: {} }

  this.plugin = new fixtures.plugin('index')
  this.plugin.register()

  this.connection = fixtures.connection.createConnection()
  this.connection.init_transaction()

  if (this.plugin.redisCfg.opts === undefined) this.plugin.redisCfg.opts = {}
  this.plugin.redisCfg.opts.retry_strategy = function () {
    return
  }

  this.plugin.init_redis_plugin((err) => {
    if (err) console.error(err.message)
    done()
  }, this.server)
}

describe('haraka-plugin-recipient-routes', function () {
  describe('rcpt file', function () {
    beforeEach(file_setup)

    it('miss returns undefined on null', async function () {
      await new Promise((resolve) => {
        this.plugin.rcpt(
          function (rc, msg) {
            assert.equal(rc, undefined)
            assert.equal(msg, undefined)
            resolve()
          },
          this.connection,
          [new Address('<miss@example.com>')],
        )
      })
    })

    it('hit returns OK', async function () {
      await new Promise((resolve) => {
        this.plugin.rcpt(
          function (rc, msg) {
            assert.equal(rc, OK)
            assert.equal(msg, undefined)
            resolve()
          },
          this.connection,
          [new Address('<matt@example.com>')],
        )
      })
    })

    it('missing domain', function () {
      try {
        this.plugin.rcpt(
          function () {
            assert.ok(false)
          },
          this.connection,
          [new Address('<matt>')],
        )
      } catch (ignore) {
        // console.error(ignore)
        // an error is expected
      }
    })

    it('lowers mixed case routes', function () {
      assert.deepEqual(this.plugin.route_list, {
        'bad@example.com': '127.0.0.1:26',
        'matt@example.com': '192.168.76.66',
        'mixed@example.com': '172.16.1.1',
      })
    })
  })

  describe('rcpt redis', function () {
    beforeEach(redis_setup)

    afterEach(function () {
      this.plugin.delete_route('matt@example.com')
      this.plugin.db.quit()
    })

    it('miss returns undefined on null', function (done) {
      const addr = new Address('<matt@example.com>')
      this.plugin.redis_ping().then((v) => {
        if (!v) {
          console.error('ERROR: no redis available!')
          return done()
        }

        this.plugin.delete_route(addr.address())
        this.plugin.rcpt(
          (rc, msg) => {
            assert.equal(rc, undefined)
            assert.equal(msg, undefined)
            done()
          },
          this.connection,
          [addr],
        )
      })
    })

    it('hit returns OK', function (done) {
      this.plugin.redis_ping().then((v) => {
        if (!v) return done()

        const addr = new Address('<matt@example.com>')
        this.plugin.insert_route(addr.address(), '192.168.2.1')
        this.plugin.rcpt(
          (rc, msg) => {
            assert.equal(rc, OK)
            assert.equal(msg, undefined)
            done()
          },
          this.connection,
          [addr],
        )
      })
    })
  })

  describe('get_mx file', function () {
    beforeEach(file_setup)

    it('email address file hit', async function () {
      this.plugin.route_list = { 'matt@example.com': '192.168.1.1' }
      const addr = new Address('<matt@example.com>')
      await new Promise((resolve) => {
        this.plugin.get_mx(
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

    it('email domain file hit', async function () {
      this.plugin.route_list = { 'example.com': '192.168.1.2' }
      const addr = new Address('<matt@example.com>')
      await new Promise((resolve) => {
        this.plugin.get_mx(
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

    it('address preferred file', async function () {
      this.plugin.route_list = {
        'matt@example.com': '192.168.1.1',
        'example.com': '192.168.1.2',
      }
      const addr = new Address('<matt@example.com>')
      await new Promise((resolve) => {
        this.plugin.get_mx(
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

  describe('get_mx redis', function () {
    beforeEach(redis_setup)

    afterEach(function () {
      this.plugin.delete_route('matt@example.com')
      this.plugin.db.quit()
    })

    it('email address redis hit', function (done) {
      this.plugin.redis_ping().then((v) => {
        if (!v) return done()

        const addr = new Address('<matt@example.com>')
        this.plugin.insert_route('matt@example.com', '192.168.2.1')
        this.plugin.get_mx(
          (rc, mx) => {
            assert.equal(rc, OK)
            assert.equal(mx, '192.168.2.1')
            this.plugin.delete_route(addr.address())
            done()
          },
          hmail,
          addr.host,
        )
      })
    })

    it('email domain redis hit', function (done) {
      this.plugin.redis_ping().then((v) => {
        if (!v) return done()

        const addr = new Address('<matt@example.com>')
        this.plugin.insert_route(addr.address(), '192.168.2.2')
        this.plugin.get_mx(
          (rc, mx) => {
            assert.equal(rc, OK)
            assert.equal(mx, '192.168.2.2')
            this.plugin.delete_route(addr.address())
            done()
          },
          hmail,
          addr.host,
        )
      })
    })

    it('address preferred redis', function (done) {
      this.plugin.redis_ping().then((v) => {
        if (!v) return done()

        this.plugin.insert_route('matt@example.com', '192.168.2.1')
        this.plugin.insert_route('example.com', '192.168.2.2')
        const addr = new Address('<matt@example.com>')

        this.plugin.get_mx(
          (rc, mx) => {
            assert.equal(rc, OK)
            assert.equal(mx, '192.168.2.1')
            this.plugin.delete_route('matt@example.com')
            this.plugin.delete_route('example.com')
            done()
          },
          hmail,
          addr.host,
        )
      })
    })
  })
})
