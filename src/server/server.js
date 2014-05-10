// Express 4
var express             = require('express');

// Express classic middlware (we should require them explicitly for Express 4)
var midSession          = require('express-session');
var midStatic           = require('serve-static');
var midCookieParser     = require('cookie-parser');

var MongoStore          = require('connect-mongo')(midSession);

// Error hander (I moved it out)
var midError            = require('./error');

// Derby
var derby               = require('derby');

// BrowserChannel is socket.io analog from Google (for Derby)
// liveDbMongo is mongoDb driver (for Derby)
var racerBrowserChannel = require('racer-browserchannel');
var liveDbMongo         = require('livedb-mongo');

derby.use(require('racer-bundle'));

exports.setup = setup;

function setup(app, options) {

  var mongoUrl = process.env.MONGO_URL || process.env.MONGOHQ_URL || 'mongodb://localhost:27017/derby-app';
  // The store creates models and syncs data
  var store = derby.createStore({
    db: liveDbMongo(mongoUrl + '?auto_reconnect', {safe: true})
  });

  var expressApp = express()
    // Respond to requests for application script bundles
    .use(app.scripts(store))

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
    , store: new MongoStore({url: mongoUrl})
    }))
    .use(createUserId)

    // Creates an express middleware from the app's routes
    .use(app.router())

    // Express routing should by placed HERE

    // Defauld route - generate 404 error
    .all('*', function(req, res, next) { next('404: ' + req.url); })

    // Error handling
    .use(midError())

  return expressApp;
}

function createUserId(req, res, next) {
  var model = req.getModel();
  var userId = req.session.userId;
  if (!userId) userId = req.session.userId = model.id();
  model.set('_session.userId', userId);
  next();
}


