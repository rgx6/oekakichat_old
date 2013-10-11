var fs = require('fs');
var uuid = require('node-uuid');
var Room = require('./room.js').Room;
var server = require('../server.js');

var nameLengthLimit = exports.nameLengthLimit = 30;
var widthMin = exports.widthMin = 100;
var widthMax = exports.widthMax = 2000;
var heightMin = exports.heightMin = 100;
var heightMax = exports.heightMax = 2000;

var globalUserCount = 0;

var rooms = {};

/**
 * socket.ioのコネクション設定
 */
exports.onConnection = function (client) {
    'use strict';
    // console.log('connected');
    
    client.emit('connected');
    
    /**
     * 部屋登録受付
     */
    client.on('create room', function (data, fn) {
        'use strict';
        // console.log('create room');
        
        if (typeof data === 'undefined' ||
            data === null ||
            !checkParamLength(data.name, nameLengthLimit) ||
            !checkParamSize(data.width, widthMin, widthMax) ||
            !checkParamSize(data.height, heightMin, heightMax)) {
            fn({ result: 'bad param' });
            return;
        }
        
        var id = uuid.v4().replace(/-/g, '');
        var configid = uuid.v4().replace(/-/g, '');
        
        // TODO : sqlinjection対策必要？
        var date = new Date().toLocaleString();
        server.db.run('INSERT INTO rooms (id, configid, name, width, height, registered, updated) \
                VALUES ($id, $configid, $name, $width, $height, $registered, $updated)',
               [ id, configid, data.name, data.width, data.height, date, date]);
        
        fn({ result: 'ok',
             id: id,
             configid: configid,
             width: data.width,
             height: data.height });
    });
    
    /**
     * 部屋入室受付
     */
    client.on('enter room', function (id, fn) {
        'use strict';
        // console.log('enter room');
        
        if (typeof id === 'undefined' || id === null) {
            fn({ result: 'bad param' });
            return;
        }
        
        // TODO : 念のためここでもid登録済チェック 共通化したい
        server.db.get('SELECT * FROM rooms WHERE id = $id', id, function (err, row) {
            if (typeof row === 'undefined') {
                fn({ result: 'bad param' });
                return;
            }
        });
        
        // 部屋オブジェクトが存在しなければ作成する
        if (typeof rooms[id] === 'undefined' || rooms[id] === null) {
            rooms[id] = new Room(id);
        }
        
        var room = rooms[id];
        
        client.set('id', id);
        client.join(id);
        
        room.userCount += 1;
        globalUserCount += 1;
        updateUserCount(id);
        
        fn({ result: 'ok', data: room.imagelog });
    });
    
    /**
     * 描画データ受付
     */
    client.on('send image', function (data) {
        'use strict';
        // console.log('send image');
        
        var id;
        client.get('id', function (err, _id) {
            if (err || !_id) { return; }
            id = _id;
        });
        
        if (typeof rooms[id] === 'undefined' || rooms[id] === null) return;
        
        rooms[id].storeImage(data);
        client.broadcast.to(id).emit('push image', data);
    });
    
    /**
     * Canvasを保存してクリア
     */
    client.on('clear canvas', function (data) {
        'use strict';
        // console.log('clear canvas');
        
        var id;
        client.get('id', function (err, _id) {
            if (err || !_id) { return; }
            id = _id;
        });
        
        if (typeof rooms[id] === 'undefined' || rooms[id] === null) return;
        
        saveImage(id, data, true);
    });
    
    /**
     * Canvasを保存
     */
    client.on('save canvas', function (data) {
        'use strict';
        // console.log('save canvas');
        
        var id;
        client.get('id', function (err, _id) {
            if (err || !_id) { return; }
            id = _id;
        });
        
        if (typeof rooms[id] === 'undefined' || rooms[id] === null) return;
        
        saveImage(id, data, false);
    });
    
    /**
     * socket切断時の処理
     */
    client.on('disconnect', function() {
        'use strict';
        // console.log('disconnect');
        
        var id;
        client.get('id', function (err, _id) {
            if (err || !_id) { return; }
            id = _id;
        });
        
        if (!id) { return; }
        
        globalUserCount -= 1;
        rooms[id].userCount -= 1;
        updateUserCount(id);
        
        console.log('[disconnect]' + '[id:' + id + ']');
    });
    
    //------------------------------
    // メソッド定義
    //------------------------------
    
    /**
     * 接続数更新
     */
    function updateUserCount (id) {
        'use strict';
        // console.log('updateUserCount');
        
        server.sockets.to(id).emit('update user count', rooms[id].userCount);
        server.sockets.emit('update global user count', globalUserCount);
    }
    
    /**
     * 画像をファイルに保存する関数
     */
    function saveImage (id, data, clearFlag) {
        'use strict';
        // console.log('saveImage');
        
        // TODO : data null/undefinedチェック
        // TODO : PNGフォーマットチェック
        
        var now = new Date();
        var date = now.getFullYear() +
                   ('0' + (now.getMonth() + 1)).slice(-2) +
                   ('0' + now.getDate()).slice(-2) + '_' +
                   ('0' + now.getHours()).slice(-2) +
                   ('0' + now.getMinutes()).slice(-2) +
                   ('0' + now.getSeconds()).slice(-2) +
                   ('00' + now.getMilliseconds()).slice(-3);
        
        var buf = new Buffer(data.png, 'base64');
        var path = './public/log/' + id + '_' + date + '.png';
        fs.writeFile(path, buf, function (err) {
            if (!err) {
                if (clearFlag) {
                    // TODO : ここでサムネイル保存にする
                    rooms[id].deleteImage();
                    server.sockets.to(id).emit('push clear canvas');
                } else {
                    // TODO : 保存しました 通知出したい
                }
            } else {
                console.log(err);
            }
        });
        
        buf = new Buffer(data.thumbnailPng, 'base64');
        path = './public/log/thumb/' + id + '_' + date + '.thumb.png';
        fs.writeFile(path, buf, function (err) {
            if (!err) {
                if (clearFlag) {
                    // TODO : ↑に入れる
                } else {
                    // TODO : 保存しました 通知出したい
                }
            } else {
                console.log(err);
            }
        });
    }
};

//------------------------------
// メソッド定義
//------------------------------

/**
 * HTMLエスケープ処理 
 */
function escapeHTML (str) {
    'use strict';
    
    // TODO : 足りなくない？'だったか？
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * nullとundefinedと文字数のチェック
 */
function checkParamLength (data, maxLength) {
    'use strict';
    
    return typeof data !== 'undefined' &&
           data !== null &&
           data.length !== 0 &&
           data.length <= maxLength;
}

/**
 * nullとundefinedと範囲のチェック
 */
function checkParamSize (data, minSize, maxSize) {
    'use strict';
    
    return typeof data !== 'undefined' &&
           data !== null &&
           data.match(/^[0-9]+$/) &&
           minSize <= data &&
           data <= maxSize;
}
