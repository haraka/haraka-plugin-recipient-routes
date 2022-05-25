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
}

exports.load_rcpt_to_routes_ini = function () {
    const plugin = this;
    plugin.cfg = plugin.config.get('rcpt_to.routes.ini', function () {
        plugin.load_rcpt_to_routes_ini();
    })

    if (!plugin.cfg.redis) plugin.cfg.redis = {};

    plugin.cfg.redis.opts = {
        host: plugin.cfg.redis.server_ip || plugin.cfg.redis.host || '127.0.0.1',
        port: plugin.cfg.redis.server_port || plugin.cfg.redis.port || 6379,
    }

    const lowered = {};
    if (plugin.cfg.routes) {
        const keys = Object.keys(plugin.cfg.routes);
        for (let i=0; i < keys.length; i++) {
            lowered[keys[i].toLowerCase()] = plugin.cfg.routes[keys[i]];
        }
        plugin.route_list = lowered;
    }
}

exports.do_file_search = function (txn, address, domain, next) {
    const plugin = this;

    if (plugin.route_list[address]) {
        txn.results.add(plugin, { pass: 'file.email' });
        return next(OK);
    }

    if (plugin.route_list[domain])  {
        txn.results.add(plugin, { pass: 'file.domain' });
        return next(OK);
    }

    // not permitted (by this rcpt_to plugin)
    txn.results.add(plugin, { fail: 'file' });
    next();
}

exports.get_rcpt_address = function (rcpt) {

    if (!rcpt.host) return [ rcpt.address().toLowerCase() ];

    return [ rcpt.address().toLowerCase(), rcpt.host.toLowerCase() ];
}

exports.do_redis_search = function (connection, address, domain, next) {
    const plugin = this;

    plugin.db.multi()
        .get(address)
        .get(domain)
        .exec()
        .then(replies => {
            // got replies from Redis, any with an MX?
            if (replies[0]) {
                connection.transaction.results.add(plugin, {pass: 'redis.email'});
                next(OK);
            }
            else if (replies[1]) {
                connection.transaction.results.add(plugin, {pass: 'redis.domain'});
                next(OK);
            }
            else {
                // no redis record, try files
                plugin.do_file_search(connection.transaction, address, domain, next);
            }
        })
        .catch(err => {
            connection.results.add(plugin, { err: err });
            next();
        })
}

exports.rcpt = function (next, connection, params) {
    const plugin = this;
    const txn = connection.transaction;
    if (!txn) return next();

    const [address, domain] = plugin.get_rcpt_address(params[0]);
    if (!domain) {      // ignore RCPT TO without an @
        txn.results.add(plugin, {fail: 'rcpt!domain'});
        return next();
    }

    // if we can't use redis, try files
    if (!plugin.redis_pings) {
        plugin.do_file_search(txn, address, domain, next);
        return;
    }

    // redis connection open, try it
    plugin.do_redis_search(connection, address, domain, next);
}

exports.parse_mx = function (entry) {

    const uri = new urlparser.parse(entry);

    if ( uri.protocol == 'lmtp:' ) {
        return {
            exchange: uri.hostname,
            port: uri.port,
            using_lmtp: true,
        }
    }

    if ( uri.protocol == 'smtp:' ) {
        return {
            exchange: uri.hostname,
            port: uri.port,
        }
    }

    return entry;
}

exports.get_mx_file = function (address, domain, next) {
    const plugin = this;

    // check email adress for route
    if (plugin.route_list[address]) {
        return next(OK, plugin.parse_mx(plugin.route_list[address]));
    }

    // check email domain for route
    if (plugin.route_list[domain]) {
        return next(OK, plugin.parse_mx(plugin.route_list[domain]));
    }

    plugin.loginfo(`using DNS MX for: ${address}`);
    next();
}

exports.get_mx = function (next, hmail, domain) {
    const plugin = this;

    // get email address
    let address = domain.toLowerCase();
    if (hmail && hmail.todo && hmail.todo.rcpt_to && hmail.todo.rcpt_to[0]) {
        address = hmail.todo.rcpt_to[0].address().toLowerCase();
    }
    else {
        plugin.logerror('no rcpt from hmail, using domain' );
    }

    // if we can't use redis, try files and return
    if (!plugin.redis_pings) {
        plugin.get_mx_file(address, domain, next);
        return;
    }

    // redis connection open, try it
    plugin.db.multi()
        .get(address)
        .get(domain)
        .exec()
        .then(replies => {
            // got replies from Redis, any with an MX?
            if (replies[0]) return next(OK, plugin.parse_mx(replies[0]));
            if (replies[1]) return next(OK, plugin.parse_mx(replies[1]));

            // no redis record, try files
            plugin.get_mx_file(address, domain, next);
        })
        .catch(err => {
            plugin.logerror(err);
            next();
        })
}

exports.insert_route = function (email, route) {
    // for importing, see http://redis.io/topics/mass-insert
    if (!this.db || !this.redis_pings) return false;

    this.db.set(email, route);
}

exports.delete_route = function (email) {
    if (!this.redis_pings) return false;

    this.db.del(email);
}
