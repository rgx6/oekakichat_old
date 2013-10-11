
var express = require('express');
var http = require('http');
var path = require('path');
var log4js = require('log4js');
var sqlite3 = require('sqlite3').verbose();
var routes = require('./routes/index.js');
var chatapp = require('./sockets/app.js');

// TODO : table unique constraint
exports.db = new sqlite3.Database('db/oekakichat.db', sqlite3.OPEN_READWRITE);

// TODO : exports設定 & 設定見直し
var logger = log4js.getLogger('oekakichat');
logger.setLevel('DEBUG');
log4js.configure({
    'appenders': [
    // console に出力
    { 'type': 'console' },
    // ファイルに出力
    {
        'type': 'file',
        'filename': 'log/log',
        'maxLogSize': 1024 * 1024,
        'backups': 50,
        // stdoutへの出力も拾う
        'category': [ 'oekakichat', 'console' ],
    }
    ],
    // stdoutへの出力も拾う
    'replaceConsole': true
});

// all environments
// TODO : パラメータで再接続不可にする？
var app = express();
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.enable('strict routing');
app.use(express.favicon());
// TODO : devいらない？
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(log4js.connectLogger(logger, {
    // 指定したログレベルで記録される
    'level': log4js.levels.INFO,
    // アクセスログを出力する際に無視する拡張子
    'nolog': [ '\\.css', '\\.js', '\\.gif', '\\.png' ],
    // アクセスログのフォーマット（以下はデフォルト出力）
    'format': ':remote-addr - - ":method :url HTTP/:http-version" :status :content-length ":referrer" ":user-agent"'
}));
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// TODO : これなんだっけ？
// development only
if ('development' === app.get('env')) {
    app.use(express.errorHandler());
}

// 末尾 / 必須の redirect 設定
app.use(function (req, res, next) {
    if (req.path.substr(-1) !== '/' && req.path.length > 1) {
        var query = req.url.slice(req.path.length);
        res.redirect(301, req.path + '/' + query);
    } else {
        next();
    }
});

// TODO : 404 コメント resの中身
app.use(function (req, res) {
    res.send(404);
});

// TODO : app root みたいに省略できない？
app.get('/oekakichat/', routes.index);
app.get('/oekakichat/:id/', routes.room);
app.get('/oekakichat/:id/log/:number/', routes.log);
app.get('/oekakichat/:id/log/list/:page/', routes.loglist);
app.get('/oekakichat/config/:configid/', routes.config);

var server = http.createServer(app);
server.listen(app.get('port'), function () {
    'use strict';
    console.log('Express server listening on port ' + app.get('port'));
});

// TODO : log level
// 'log lever' : 0 error  1 warn  2 info  3 debug / log: false
var io = require('socket.io').listen(server, { 'log level': 2 });
exports.sockets = io.sockets.on('connection', chatapp.onConnection);
