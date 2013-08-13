(function () {
  'use strict';
  var socket;
  var dictionary = '';

  $(document).ready(function () {
    // console.log('ready');

    // サーバに接続
    // var host = 'http://rgx.c.node-ninja.com/';
    // var host = 'http://rgx.sakura.ne.jp/';
    var host = 'http://localhost/';
    socket = io.connect(host);

    //------------------------------
    // メッセージハンドラ定義
    //------------------------------

    /**
     * 接続できたら画面を初期化するための情報を要求する
     */
    socket.on('connected', function () {
      // console.log('connected');

      socket.emit('init lobby');
    });

    /**
     * 部屋情報を受け取って表示を更新する
     */
    socket.on('update lobby', function (rooms) {
      // console.log('update lobby');

      updateRoomsInfo(rooms);
    });

    //------------------------------
    // イベントハンドラ定義
    //------------------------------

    /**
     * 辞書ファイルドロップ領域のdragoverイベント
     */
    $('#dictionaryTarget').on('dragover', function (event) {
      // console.log('drag over');

      event.preventDefault();
    });

    /**
     * 辞書ファイルドロップ領域のdropイベント
     */
    $('#dictionaryTarget').on('drop', function (event) {
      // console.log('drop');

      dictionary = '';
      // TODO : 1単語の文字数、単語数に制限を設ける
      // TODO : ファイル1つ1つの読込状況が分かるようにする
      var files = event.originalEvent.dataTransfer.files;
      for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        
        // $('#dictionaryTarget').append(file.name + ' start' + '<br />');
        // console.log(file.name + ' start' + '\n')
        var fileReader = new FileReader();
        fileReader.onload = function (event) {
          var lines = event.target.result.split('\n');
          for (var l = 0; l < lines.length; l += 1) {
            var word = lines[l].trim().match(/^[あ-んー]+/);
            if (word !== null && word.length > 0) {
              dictionary += word + '\n';
            }
          }

          // $('#dictionaryTarget').append(file.name + ' end' + '<br />');
          // TODO : fileが最後に実行されたものになってしまう
          // console.log(file.name + ' end' + '\n')
          // console.log(dictionary);
        };

        fileReader.readAsText(file, 'shift-jis');
        event.preventDefault();
      }
    });

    /**
     * 部屋作成に必要な情報を送る
     */
    $('#create-room').on('click', function () {
      var credentials = {
        roomName:   $('#new-room-name').val(),
        comment:    $('#new-room-comment').val(),
        playerName: $('#new-player-name').val(),
        password:   $('#new-password').val(),
        // TODO : trim()は仮
        dictionary: dictionary.trim()
      };

      socket.emit('create room', credentials, function (data) {
        if (data.result === 'bad param') {
          // TODO : エラー表示
          alert('不正なパラメータです');
        } else if (data.result === 'room exist') {
          // TODO : エラー表示
          alert('同じ名前の部屋があります');
        } else if (data.result === 'ok') {
          $.form({
            type: 'post',
            url:  'gameroom/',
            data: { token: data.token }
          });
        } else {
          // TODO : エラー
          alert('予期しないエラーです');
        }
      });
    });

    /**
     * 既存の部屋への入室に必要な情報を送る
     */
    $('#enter-room').on('click', function () {
      // TODO : 部屋を一覧から選択できるようにする
      var credentials = {
        id:         $('#roomList tbody tr.info').attr('id'),
        playerName: $('#enter-player-name').val(),
        password:   $('#enter-password').val(),
      };

      socket.emit('enter room', credentials, function (data) {
        if (data.result === 'bad param') {
          // TODO : エラー表示
          alert('不正なパラメータです');
        } else if (data.result === 'not exist') {
          // TODO : エラー表示
          alert('部屋がありません');
        } else if (data.result === 'password ng') {
          // TODO : エラー表示
          alert('パスワードが違います');
        } else if (data.result === 'full') {
          // TODO : エラー表示
          alert('満員です');
        } else if (data.result === 'name exist') {
          // TODO : エラー表示
          alert('同じ名前のプレイヤーがいます');
        } else if (data.result === 'ok') {
          $.form({
            type: 'post',
            url:  'gameroom/',
            data: { token: data.token }
          });
        } else {
          // TODO : エラー
          alert('予期しないエラーです');
        }
      });
    });

    /**
     * バグ報告等
     */
    $('#bug').on('keydown', function (e) {
      if ((e.which && e.which === 13) || (e.keyCode && e.keyCode === 13)) {
        var message = $('#bug').val();

        if (0 < message.length && message.length <= 500) {
          socket.emit('send bug', { message: message, from: 'room' }, function () {
            // メッセージの送信に成功したらテキストボックスをクリアする
            $('#bug').val('');
          });
        }

        return false;
      } else {
        return true;
      }
    });

    // TODO : コメント
    $('#roomList tbody tr').live('click', function () {
      if (!$(this).hasClass('info')) {
        $('#roomList tr.info').removeClass('info');
        $(this).addClass('info');
      }
      // TODO : 部屋がなくなった場合にパスワード欄が有効のままになる
      if ($(this).children('td#password').text() === 'あり') {
        $('#enter-password').attr('required');
        $('#enter-password').removeAttr('readonly');
      } else {
        $('#enter-password').attr('readonly', '');
        $('#enter-password').removeAttr('required', '');
        $('#enter-password').val('');
      }

      var roomName = $(this).children('td#name').text();
      $('#enter-room-name').val(roomName);
    });

    //------------------------------
    // その他
    //------------------------------

    /**
     * 部屋情報を表示する
     */
    function updateRoomsInfo (rooms) {
      // TODO : 整形
      $('#roomList').empty();
      var html = '';
      html += "<table class='table table-hover' border='1'><thead><tr><th>部屋名</th><th>パスワード</th><th>人数</th><th>コメント</th><th>辞書</th></tr></thead><tbody>";
      for (var i = 0; i < rooms.length; i += 1) {
        var room = rooms[i];
        html += '<tr id=\'' + room.id + '\'><td id=\'name\'>' + room.name + '</td><td id=\'password\'>' + (room.password ? 'あり' : 'なし') +
                '</td><td>' + room.playerCount + '/' + room.playerCountMax + '</td><td>' + room.comment + '</td><td>' + room.dictionaryName + '</td></tr>';
      }
      html += '</tbody></table>';
      $('#roomList').append(html);
    }

    /**
     * POST 後に画面遷移するための関数
     */
    $.form = function (s) {
      var def = {
        type: 'get',
        url: location.href,
        data: {}
      };
  
      s = $.extend(true, s, $.extend(true, {}, def, s));
  
      var form = $('<form>')
        .attr({
          'method': s.type,
          'action': s.url
        })
        .appendTo(document.body);
  
      for (var a in s.data) {
        $('<input>')
          .attr({
            'name': a,
            'value': s.data[a]
          })
          .appendTo(form[0]);
      }
  
      form[0].submit();
    };
  });
})();
