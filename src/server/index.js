var derby = require('derby');

exports.run = function (app, options, cb) {

  options = options || {};
  var port = options.port || process.env.PORT || 3000;

  derby.run(createServer);

  function createServer() {
    if (typeof app === 'string') app = require(app);

    var expressApp = require('./server.js').setup(app, options);

    var server = require('http').createServer(expressApp);
    server.listen(port, function (err) {
      console.log('%d listening. Go to: http://localhost:%d/', process.pid, port);
      cb && cb(err);
    });
  }
}
