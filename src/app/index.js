var derby = require('derby');
var path = require('path');
var app = module.exports = derby.createApp('derby-app', __filename);
app.serverUse(module, 'derby-stylus');

global.app = app;

app.loadViews(path.join(__dirname, '/../../views'));
app.loadStyles(path.join(__dirname, '/../../styles'));

app.get('/', function getPage(page, model) {
  page.render();
});

