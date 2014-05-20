// 4-ый экспресс
var express = require('express');

// В 4-ом экспрессе все middleware вынесены в отдельные модули
// приходится каждый из них подключать по отдельности
var session = require('express-session');

//Подключаем store
var connectStore, sessionStore;
if (process.env.REDIS_HOST) {
    var redis = require('redis');

    var redisClient;
    redisClient = redis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST);
    if (process.env.REDIS_PASSWORD) redisClient.auth(process.env.REDIS_PASSWORD);

    connectStore = require('connect-redis')(session);
    sessionStore = new connectStore({host: process.env.REDIS_HOST, port: process.env.REDIS_PORT, pass: process.env.REDIS_PASSWORD});
} else {
    connectStore = require('connect-mongo')(session);
    sessionStore = new connectStore({url: process.env.MONGO_URL});
}

// Обработчик ошибок - я вынес его в отдельную папочку,
// чтобы не отвекал
var midError = require('./error');

var derby = require('derby');

// BrowserChannel - аналог socket.io от Гугла - транспорт, используемый
// дерби, для передачи данных из браузеров на сервер

// liveDbMongo - драйвер монги для дерби - умеет реактивно обновлять данные
var racerBrowserChannel = require('racer-browserchannel');
var liveDbMongo = require('livedb-mongo');

// Подключаем механизм создания бандлов browserify
derby.use(require('racer-bundle'));

exports.setup = function setup(app, options) {

    // Инициализируем подкючение к БД (здесь же обычно подключается еще и redis)
    var store = derby.createStore({
        db: liveDbMongo(process.env.MONGO_URL + '?auto_reconnect', {safe: true}),
        redis: redisClient
    });

    var expressApp = express()

    // Здесь приложение отдает свой "бандл"
    // (т.е. здесь обрабатываются запросы к /derby/...)
    expressApp.use(app.scripts(store));

    if (options && options.static) {
        expressApp.use(require('serve-static')(options.static));
    }

    // Здесь в бандл добавляется клиетский скрипт browserchannel,
    // и возвращается middleware обрабатывающее клиентские сообщения
    // (browserchannel основан на longpooling - т.е. здесь обрабатываются
    // запросы по адресу /channel)
    expressApp.use(racerBrowserChannel(store));

    // В req добавляется метод getModel, позволяющий обычным
    // express-овским котроллерам читать и писать в БД см. createUserId
    expressApp.use(store.modelMiddleware());

    expressApp.use(require('cookie-parser')(process.env.SESSION_COOKIE));
    expressApp.use(session({
        secret: process.env.SESSION_SECRET,
        store: sessionStore
    }));

    expressApp.use(createUserId);

    // Здесь регистрируем контроллеры дерби-приложения,
    // они будут срабатывать, когда пользователь будет брать страницы с сервера
    expressApp.use(app.router());

    // Если бы у на были обычные экспрессовские роуты - мы бы положили их СЮДА

    // Маршрут по умолчанию - генерируем 404 ошибку
    expressApp.all('*', function (req, res, next) {
        next('404: ' + req.url);
    });

    // Обработчик ошибок
    expressApp.use(midError());

    return expressApp;
}

// Пробрасываем id-юзера из сессии в модель дерби,
// если в сессии id нет - генерим случайное
function createUserId(req, res, next) {
    var model = req.getModel();
    var userId = req.session.userId;
    if (!userId) userId = req.session.userId = model.id();
    model.set('_session.userId', userId);
    next();
}


