var derby = require('derby');

var express             = require('express');
var redis               = require('redis');
var racerBrowserChannel = require('racer-browserchannel');
var liveDbMongo         = require('livedb-mongo');

var midSession          = require('express-session');
var midStatic           = require('serve-static');
var midCookieParser     = require('cookie-parser');
var midFavicon          = require('serve-favicon');
var midCompress         = require('compression');

var RedisStore          = require('connect-redis')(midSession);

var parseUrl            = require('url').parse;
var error               = require('./error');

derby.use(require('racer-bundle'));

exports.setup = setup;

function setup(app, options) {
  var redisClient = getRedisClient();

  var mongoUrl = process.env.MONGO_URL || process.env.MONGOHQ_URL || 'mongodb://localhost:27017/derby-app';
  // The store creates models and syncs data
  var store = derby.createStore({
    db: liveDbMongo(mongoUrl + '?auto_reconnect', {safe: true})
  , redis: redisClient
  });

  store.on('bundle', function(browserify) {
    // Add support for directly requiring coffeescript in browserify bundles
    //browserify.transform({global: true}, coffeeify);

    // HACK: In order to use non-complied coffee node modules, we register it
    // as a global transform. However, the coffeeify transform needs to happen
    // before the include-globals transform that browserify hard adds as the
    // first trasform. This moves the first transform to the end as a total
    // hack to get around this
    var pack = browserify.pack;
    browserify.pack = function(opts) {
      var detectTransform = opts.globalTransform.shift();
      opts.globalTransform.push(detectTransform);
      return pack.apply(this, arguments);
    };
  });

  var expressApp = express()
    //.use(midFavicon(__dirname + '../../../public/img/favicon.ico'))
    .use(midCompress())
    // Respond to requests for application script bundles
    .use(app.scripts(store, {extensions: ['.coffee']}))

  if (options && options.static) {
    expressApp.use(midStatic(options.static));
  }

  expressApp
    // Add browserchannel client-side scripts to model bundles created by store,
    // and return middleware for responding to remote client messages
    .use(racerBrowserChannel(store))
    // Adds req.getModel method
    .use(store.modelMiddleware())

    .use(midCookieParser())
    .use(midSession({
      secret: process.env.SESSION_SECRET || 'YOUR SECRET HERE'
    , store: new RedisStore()
    }))
    .use(createUserId)

    // Creates an express middleware from the app's routes
    .use(app.router())

    // Express routing
    .all('*', function(req, res, next) { next('404: ' + req.url); })

    .use(error())

  return expressApp;
}

function createUserId(req, res, next) {
  var model = req.getModel();
  var userId = req.session.userId;
  if (!userId) userId = req.session.userId = model.id();
  model.set('_session.userId', userId);
  next();
}

function getRedisClient(){
  var redisClient;
  if (process.env.REDIS_HOST) {
    redisClient = redis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST);
    redisClient.auth(process.env.REDIS_PASSWORD);
  } else if (process.env.OPENREDIS_URL) {
    var redisUrl = parseUrl(process.env.OPENREDIS_URL);
    redisClient = redis.createClient(redisUrl.port, redisUrl.hostname);
    redisClient.auth(redisUrl.auth.split(":")[1]);
  } else {
    redisClient = redis.createClient();
  }
  return redisClient;
}


