var derby = require('derby');
var config = require('./config');

process.env.NODE_ENV = config.get('environment');
process.env.MONGO_URL = config.get('mongodb:uri');
process.env.SESSION_SECRET = config.get('session:secret');
process.env.SESSION_KEY = config.get('session:key');
process.env.SESSION_COOKIE = config.get('session:cookie');
process.env.PORT = config.get('port');
process.env.REDIS_HOST = config.get('redis:host');
process.env.REDIS_PORT = config.get('redis:port');
process.env.REDIS_PASSWORD = config.get('redis:pass');

var options = {
  static: __dirname + '/../../public'
};

exports.run = function run(app, options, cb) {
  options || (options = {});

  function listenCallback(err) {
    console.log('%d listening. Go to: http://localhost:%d/', process.pid, process.env.PORT);
    cb && cb(err);
  }

  function createServer() {
    if (typeof app === 'string') app = require(app);
    require('./server').setup(app, options, function (err, expressApp) {
      if (err) throw err;
      var server = require('http').createServer(expressApp);
      server.listen(process.env.PORT, listenCallback);
    });
  }

  derby.run(createServer);
}