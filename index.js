// rcpt_to.routes - per email/domain mail routes
//
// validates incoming recipients against flat file & Redis
// routes mail based on per-email or per-domain specified routes

const urlparser = require('url');

exports.register = function () {
  this.inherits('haraka-plugin-redis');

  this.cfg = {};
  this.route_list={};

  this.load_rcpt_to_routes_ini();
  this.merge_redis_ini();
  this.redis_ping();

  this.register_hook('init_master',  'init_redis_plugin');
  this.register_hook('init_child',   'init_redis_plugin');

  this.register_hook('rcpt',   'rcpt');
  this.register_hook('get_mx', 'get_mx');
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

exports.do_file_search = async function (txn, address, domain) {

  if (this.route_list[address]) {
    txn.results.add(this, { pass: 'file.email' });
    return OK
  }

  if (this.route_list[domain])  {
    txn.results.add(this, { pass: 'file.domain' });
    return OK
  }

  // not permitted (by this rcpt_to plugin)
  txn.results.add(this, { fail: 'file' });
}

exports.get_rcpt_address = function (rcpt) {

  if (!rcpt.host) return [ rcpt.address().toLowerCase() ];

  return [ rcpt.address().toLowerCase(), rcpt.host.toLowerCase() ];
}

exports.do_redis_search = async function (connection, address, domain) {

  const replies = await this.db.multi()
    .get(address)
    .get(domain)
    .exec()

  try {
    // any replies from Redis with an MX?
    if (replies[0]) {
      connection.transaction.results.add(this, {pass: 'redis.email'});
      return OK;
    }
    if (replies[1]) {
      connection.transaction.results.add(this, {pass: 'redis.domain'});
      return OK
    }

    // no redis record, try files
    return await this.do_file_search(connection.transaction, address, domain);
  }
  catch (err) {
    connection.results.add(this, { err });
  }
}

exports.rcpt = async function (next, connection, params) {

  const txn = connection.transaction;
  if (!txn) return next();

  const [address, domain] = this.get_rcpt_address(params[0]);
  if (!domain) {      // ignore RCPT TO without an @
    txn.results.add(this, {fail: 'rcpt!domain'});
    return next();
  }

  // if we can't use redis, try files
  if (!!this.db && ! await this.redis_ping() ) {
    return next(await this.do_file_search(txn, address, domain));
  }



  // redis connection open, try it
  next(await this.do_redis_search(connection, address, domain))
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

  // check email adress for route
  if (this.route_list[address]) {
    return next(OK, this.parse_mx(this.route_list[address]));
  }

  // check email domain for route
  if (this.route_list[domain]) {
    return next(OK, this.parse_mx(this.route_list[domain]));
  }

  this.loginfo(`using DNS MX for: ${address}`);
  next();
}

exports.get_mx = async function (next, hmail, domain) {

  // get email address
  let address = domain.toLowerCase();
  if (hmail && hmail.todo && hmail.todo.rcpt_to && hmail.todo.rcpt_to[0]) {
    address = hmail.todo.rcpt_to[0].address().toLowerCase();
  }
  else {
    this.logerror('no rcpt from hmail, using domain' );
  }

  // if we can't use redis, try files and return
  if (!! this.db && ! await this.redis_ping() ) {
    this.get_mx_file(address, domain, next);
    return;
  }

  // redis connection open, try it
  const replies = await this.db.multi()
    .get(address)
    .get(domain)
    .exec()

  try {
    // got replies from Redis, any with an MX?
    if (replies[0]) return next(OK, this.parse_mx(replies[0]));
    if (replies[1]) return next(OK, this.parse_mx(replies[1]));

    // no redis record, try files
    this.get_mx_file(address, domain, next);
  }
  catch (err) {
    this.logerror(err);
    next();
  }
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
