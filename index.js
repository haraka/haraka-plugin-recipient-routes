// rcpt_to.routes - per email/domain mail routes
//
// validates incoming recipients against flat file & Redis
// routes mail based on per-email or per-domain specified routes

const urlparser = require('url');

exports.register = function () {
    const plugin = this;
    plugin.inherits('haraka-plugin-redis');

    plugin.cfg = {};
    plugin.route_list={};

    plugin.load_rcpt_to_routes_ini();
    plugin.merge_redis_ini();

    plugin.register_hook('init_master',  'init_redis_plugin');
    plugin.register_hook('init_child',   'init_redis_plugin');

    plugin.register_hook('rcpt',   'rcpt');
    plugin.register_hook('get_mx', 'get_mx');
};

exports.load_rcpt_to_routes_ini = function () {
    const plugin = this;
    plugin.cfg = plugin.config.get('rcpt_to.routes.ini', function () {
        plugin.load_rcpt_to_routes_ini();
    });

    if (!plugin.cfg.redis) plugin.cfg.redis = {};
    const r = plugin.cfg.redis;

    plugin.cfg.redis.opts = {
        host: r.server_ip || r.host || '127.0.0.1',
        port: r.server_port || r.port || 6379,
    };

    const lowered = {};
    if (plugin.cfg.routes) {
        const keys = Object.keys(plugin.cfg.routes);
        for (let i=0; i < keys.length; i++) {
            lowered[keys[i].toLowerCase()] = plugin.cfg.routes[keys[i]];
        }
        plugin.route_list = lowered;
    }
};

exports.rcpt = function (next, connection, params) {
    const plugin = this;
    const txn = connection.transaction;
    if (!txn) { return next(); }

    const rcpt = params[0];

    // ignore RCPT TO without an @ first
    if (!rcpt.host) {
        txn.results.add(plugin, {fail: 'rcpt!domain'});
        return next();
    }

    const address = rcpt.address().toLowerCase();
    const domain = rcpt.host.toLowerCase();

    const do_file_search = function () {
        if (plugin.route_list[address]) {
            txn.results.add(plugin, {pass: 'file.email'});
            return next(OK);
        }
        if (plugin.route_list[domain])  {
            txn.results.add(plugin, {pass: 'file.domain'});
            return next(OK);
        }

        // not permitted (by this rcpt_to plugin)
        txn.results.add(plugin, {fail: 'file'});
        return next();
    };

    // if we can't use redis, try files and return
    if (!plugin.redis_pings) { return do_file_search(); }

    // redis connection open, try it
    plugin.db.multi()
        .get(address)
        .get(domain)
        .exec(function (err, replies) {
            if (err) {
                connection.results.add(plugin, {err: err});
                return next();
            }

            // got replies from Redis, any with an MX?
            if (replies[0]) {
                txn.results.add(plugin, {pass: 'redis.email'});
                return next(OK);
            }
            if (replies[1]) {
                txn.results.add(plugin, {pass: 'redis.domain'});
                return next(OK);
            }

            return do_file_search(); // no redis record, try files
        });
};

exports.get_mx = function (next, hmail, domain) {
    const plugin = this;

    // get email address
    let address = domain.toLowerCase();
    if (hmail && hmail.todo && hmail.todo.rcpt_to && hmail.todo.rcpt_to[0]) {
        address = hmail.todo.rcpt_to[0].address().toLowerCase();
    }
    else {
        plugin.logerror('no rcpt from hmail, falling back to domain' );
    }

    const do_file_search = function () {
        const mx = {};
        // check email adress for route
        if (plugin.route_list[address]) {
            const uri = new urlparser.parse(plugin.route_list[address]);
            if ( uri.protocol == 'lmtp:' ) {
                mx.exchange = uri.hostname;
                mx.port = uri.port;
                mx.using_lmtp = true;
                return next(OK, mx);
            }
            else if ( uri.protocol == 'smtp:' ) {
                mx.exchange = uri.hostname;
                mx.port = uri.port;
                return next(OK, mx);
            }
            else {
                return next(OK, plugin.route_list[address]);
            }
        }

        // check email domain for route
        if (plugin.route_list[domain]) {
            return next(OK, plugin.route_list[domain]);
        }

        plugin.loginfo(`using DNS MX for: ${address}`);
        return next();
    };

    // if we can't use redis, try files and return
    if (!plugin.redis_pings) { return do_file_search(); }

    // redis connection open, try it
    plugin.db.multi()
        .get(address)
        .get(domain)
        .exec(function (err, replies) {
            if (err) {
                plugin.logerror(err);
                return next();
            }

            // got replies from Redis, any with an MX?
            if (replies[0]) { return next(OK, replies[0]); }
            if (replies[1]) { return next(OK, replies[1]); }

            return do_file_search(); // no redis record, try files
        });
};

exports.insert_route = function (email, route) {
    // for importing, see http://redis.io/topics/mass-insert
    if (!this.db || !this.redis_pings) { return false; }
    this.db.set(email, route);
};

exports.delete_route = function (email, cb) {
    if (!this.redis_pings) {
        if (cb) cb();
        return false;
    }
    if (cb) {
        this.db.del(email, cb);
    }
    else {
        this.db.del(email);
    }
};
