
var fs = require('fs');
var server = require('../server.js');
var chatapp = require('../sockets/app.js');

var appTitle = 'お絵かきチャット';

var nameMax = chatapp.nameLengthLimit;
var widthMin = chatapp.widthMin;
var widthMax = chatapp.widthMax;
var heightMin = chatapp.heightMin;
var heightMax = chatapp.heightMax;

/**
 * function
 */

/**
 * 部屋の存在確認
 */
function isIdRegisterd (id) {
    server.db.get('SELECT * FROM rooms WHERE id = $id', id, function (err, row) {
        // TODO : errの扱い？
        return typeof row !== 'undefined';
    });
}

/**
 * routing
 */

exports.index = function (req, res) {
    'use strict';

    res.render('index', {
        title: appTitle,
        // TODO : いらないかも↓
        nameMax: nameMax,
        widthMin: widthMin,
        widthMax: widthMax,
        heightMin: heightMin,
        heightMax: heightMax });
};

exports.room = function (req, res) {
    'use strict';
    
    if (typeof req.params.id === 'undefined' ||
        req.params.id === null ||
        req.params.id.length !== 32) {
        res.render('error', { title: appTitle });
        return;
    }
    
    server.db.get('SELECT name, width, height FROM rooms WHERE id = $id', req.params.id, function (err, row) {
        // TODO : errの扱い？
        if (typeof row === 'undefined') {
            res.render('error', { title: appTitle });
            return;
        }
        res.render('room', {
            title: appTitle + ' - ' + row.name,
            id: req.params.id,
            width: row.width,
            height: row.height
        });
    });
};

exports.log = function (req, res) {
    'use strict';
    // 部屋の存在確認
    // ファイルとかの確認も必要？別にいらないか？
    // logだけ別鯖に置くのもありか？
    res.render('log', { title: appTitle, id: req.params.id, page: req.params.page });
};

exports.loglist = function (req, res) {
    'use strict';
    
    if (typeof req.params.id === 'undefined' ||
        req.params.id === null ||
        req.params.id.length !== 32) {
        res.render('error', { title: appTitle });
        return;
    }
    
    var fs = require('fs');
    var fileList = [];
    fs.readdir('./public/log/thumb/', function (err, files) {
        if (err) throw err;
        files.filter(function (file) {
            var re = new RegExp('^' + req.params.id + '.*\.thumb\.png$');
            return re.test(file);
        }).forEach (function (file) {
            fileList.push(file);
        });
    });
    console.log(fileList.length);
    fileList.sort();
    console.log(fileList.length);
    res.render('loglist', { title: appTitle, files: fileList });
};

exports.config = function (req, res) {
    res.render('config', { title: appTitle, id: req.params.id, page: req.params.page });
};
