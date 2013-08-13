
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var log4js = require('log4js');
// TODO : rename
var chatsockets = require('./sockets/app.js');

var logger = log4js.getLogger('catchhogehoge');
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
      'category': [ 'catchhogehoge', 'console' ],
    }
  ],
  // stdoutへの出力も拾う
  'replaceConsole': true
});

// all environments
// TODO : パラメータで再接続不可にする
var app = express();
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.enable('strict routing');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(log4js.connectLogger(logger, {
  // 指定したログレベルで記録される
  'level': log4js.levels.INFO,
  // アクセスログを出力する際に無視する拡張子
  'nolog': [ '\\.css', '\\.js', '\\.gif' ],
  // アクセスログのフォーマット（以下はデフォルト出力）
  'format': ':remote-addr - - ":method :url HTTP/:http-version" :status :content-length ":referrer" ":user-agent"'
}));
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

// TODO : 変数化 
app.get('/catchhogehoge/', routes.index);
app.get('/catchhogehoge', routes.redirectToIndex);
app.post('/catchhogehoge/gameroom/', routes.room);

var server = http.createServer(app);
server.listen(app.get('port'), function () {
  'use strict';
  console.log('Express server listening on port ' + app.get('port'));
});

// TODO : debug
var io = require('socket.io').listen(server, {log:false});
// global object
sockets = io.sockets.on('connection', chatsockets.onConnection);
