
var appName = 'キャッチ○○○○○○（開発中）';

exports.index = function (req, res) {
  'use strict';
  res.render('lobby', { title: appName });
};

exports.redirectToIndex = function (req, res) {
  'use strict';
  res.redirect('/catchhogehoge/');
};

exports.room = function (req, res) {
  'use strict';
  var token = req.body.token || '';

  // TODO : エラーページを表示するか、lobbyにリダイレクトさせたい
  if (token === '') {
    res.send(500);
    return;
  }

  var params = {
    title: appName,
    token: token
  };
  res.render('gameroom', params);
};
