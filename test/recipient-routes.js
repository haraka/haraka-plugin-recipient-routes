'use strict';

const Address      = require('address-rfc2821').Address;
const fixtures     = require('haraka-test-fixtures');

const hmail = {
    todo: {
        "queue_time":1402091363826,
        "domain":"example.com",
        "rcpt_to":[ new Address('matt@example.com') ],
        "mail_from": new Address('<>'),
        "notes": {
            authentication_results: [ 'spf=pass smtp.mailfrom=example.net' ],
            spf_mail_result: 'Pass',
            local_sender: true,
        },
        "uuid":"DFB28F2B-CC21-438B-864D-934E6860AB61.1",
    },
};

function _set_up_file (done) {

    this.server = {};
    this.plugin = new fixtures.plugin('index');

    this.plugin.register();
    this.connection = fixtures.connection.createConnection();
    this.connection.transaction = fixtures.transaction.createTransaction();
    this.connection.transaction.results = new fixtures.results(this.connection);

    done();
}

function _set_up_redis (done) {

    this.server = {};
    this.plugin = new fixtures.plugin('index');

    this.connection = fixtures.connection.createConnection();
    this.connection.transaction = fixtures.transaction.createTransaction();
    this.connection.transaction.results = new fixtures.results(this.connection);

    this.plugin.register();
    this.plugin.server = { notes: { } };
    if (this.plugin.redisCfg.opts === undefined) this.plugin.redisCfg.opts = {}
    this.plugin.redisCfg.opts.retry_strategy = function (options) {
        return;
    };

    const t = this;
    this.plugin.init_redis_shared(function (err) {
        if (err) {
            console.error(err.message);
            return done();
        }

        t.plugin.db = t.plugin.server.notes.redis;
        t.plugin.redis_ping(function (err2, result) {
            if (err2) {
                console.error(err2.message);
                return done();
            }
            done(err2, result);
        });
    }, this.plugin.server);
}

function _tear_down_redis (done) {
    this.plugin.delete_route('matt@example.com', done);
}

exports.rcpt_file = {
    setUp : _set_up_file,
    'miss' : function (test) {
        test.expect(2);
        function cb (rc, msg) {
            test.equal(rc, undefined);
            test.equal(msg, undefined);
            test.done();
        }
        this.plugin.rcpt(cb, this.connection, [ new Address('<matt@example.com>') ]);
    },
    'hit' : function (test) {
        test.expect(2);
        function cb (rc, msg) {
            test.equal(rc, OK);
            test.equal(msg, undefined);
            test.done();
        }
        this.plugin.route_list = {'matt@example.com': '192.168.1.1'};
        this.plugin.rcpt(cb, this.connection, [new Address('<matt@example.com>')]);
    },
    'missing domain' : function (test) {
        test.expect(1);
        function cb (rc, msg) {
            test.done();
        }
        this.plugin.route_list = {'matt@example.com': '192.168.1.1'};
        try {
            this.plugin.rcpt(cb, this.connection, [new Address('<matt>')]);
        }
        catch (e) {
            test.equal(e.message, 'Invalid domain in address: matt');
            test.done();
        }
    },
}




exports.rcpt_redis = {
    setUp : _set_up_redis,
    tearDown : _tear_down_redis,
    'miss' : function (test) {
        const addr = new Address('<matt@example.com>');
        if (this.plugin.redis_pings) {
            this.plugin.delete_route(addr.address());
            test.expect(2);
            this.plugin.rcpt((rc, msg) => {
                test.equal(rc, undefined);
                test.equal(msg, undefined);
                test.done();
            }, this.connection, [addr]);
        }
        else {
            console.error('ERROR: no redis available!');
            test.expect(0);
            test.done();
        }
    },
    'hit' : function (test) {
        const addr = new Address('<matt@example.com>');
        if (this.plugin.redis_pings) {
            this.plugin.insert_route(addr.address(),'192.168.2.1');
            test.expect(2);
            this.plugin.rcpt((rc, msg) => {
                test.equal(rc, OK);
                test.equal(msg, undefined);
                test.done();
            }, this.connection, [addr]);
        }
        else {
            test.expect(0);
            test.done();
        }
    },
}

exports.get_mx_file = {
    setUp : _set_up_file,
    'email address file hit' : function (test) {
        test.expect(2);

        this.plugin.route_list = {'matt@example.com': '192.168.1.1'};
        const addr = new Address('<matt@example.com>');
        this.plugin.get_mx((rc, mx) => {
            test.equal(rc, OK);
            test.equal(mx, '192.168.1.1');
            test.done();
        }, hmail, addr.host);
    },
    'email domain file hit' : function (test) {
        test.expect(2);
        this.plugin.route_list = {'example.com': '192.168.1.2'};
        const addr = new Address('<matt@example.com>');
        this.plugin.get_mx((rc, mx) => {
            test.equal(rc, OK);
            test.equal(mx, '192.168.1.2');
            test.done();
        }, hmail, addr.host);
    },
    'address preferred file' : function (test) {
        test.expect(2);
        this.plugin.route_list = {
            'matt@example.com': '192.168.1.1',
            'example.com': '192.168.1.2',
        };
        const addr = new Address('<matt@example.com>');
        this.plugin.get_mx((rc, mx) => {
            test.equal(rc, OK);
            test.equal(mx, '192.168.1.1');
            test.done();
        }, hmail, addr.host);
    },
}

exports.get_mx_redis = {
    setUp : _set_up_redis,
    tearDown : _tear_down_redis,
    'email address redis hit' : function (test) {
        if (!this.plugin.redis_pings) {
            test.expect(0);
            test.done();
            return;
        }

        const addr = new Address('<matt@example.com>');
        test.expect(2);
        this.plugin.insert_route('matt@example.com','192.168.2.1');
        this.plugin.get_mx((rc, mx) => {
            test.equal(rc, OK);
            test.equal(mx, '192.168.2.1');
            test.done();
            this.plugin.delete_route(addr.address());
        }, hmail, addr.host);
    },
    'email domain redis hit' : function (test) {
        if (!this.plugin.redis_pings) {
            test.expect(0);
            test.done();
            return;
        }

        const addr = new Address('<matt@example.com>');
        test.expect(2);
        this.plugin.insert_route(addr.address(),'192.168.2.2');
        this.plugin.get_mx((rc, mx) => {
            test.equal(rc, OK);
            test.equal(mx, '192.168.2.2');
            test.done();
            this.plugin.delete_route(addr.address());
        }, hmail, addr.host);
    },
    'address preferred redis' : function (test) {
        if (!this.plugin.redis_pings) {
            test.expect(0);
            test.done();
            return;
        }

        test.expect(2);
        this.plugin.insert_route('matt@example.com','192.168.2.1');
        this.plugin.insert_route(     'example.com','192.168.2.2');
        const addr = new Address('<matt@example.com>');

        this.plugin.get_mx((rc, mx) => {
            test.equal(rc, OK);
            test.equal(mx, '192.168.2.1');
            test.done();
            this.plugin.delete_route('matt@example.com');
            this.plugin.delete_route(     'example.com');
        }, hmail, addr.host);
    },
}
