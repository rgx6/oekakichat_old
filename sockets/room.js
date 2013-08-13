(function () {
  'use strict';

  var Dictionary = require('./dictionary.js').Dictionary;

  var Room = (function () {

    /**
     * コンストラクタ
     */
    function Room (id, name, comment, password, words) {
      // 部屋のID
      this.id             = id;
      // 部屋の名前
      this.name           = name;
      // 部屋のコメント
      this.comment        = comment;
      // 部屋のパスワード
      this.password       = password;
      // 辞書
      this.dictionary     = new Dictionary(words);
      // お題
      this.theme          = null;
      // 直前に出したヒント
      this.lastHint       = null;
      // プレイヤー管理用オブジェクト
      this.players        = [];
      // playersにおけるpainterのindex
      this.painterIndex   = 0;
      // お絵かきログ
      this.imagelog       = [];
      // ゲームモード
      this.mode           = 'chat';
      // 現在のターン
      this.turn           = 0;
      // 現在のラウンド
      this.round          = 0;
      // 残り時間
      this.timeLeft       = 0;
      // 1ゲームのラウンド数
      this.roundMax       = 2;
      // プレイヤー数上限
      this.playerCountMax = 8;
    }

    // 定数

    // 1ターンの秒数
    var turnSecond         = 120;
    // TODO : ヒントを出すタイミングを文字数によって変えたり、ランダム要素を取り入れたほうがいいか？
    // 最初のヒントを出す時間
    var firstHintTime      = 90;
    // 2回目のヒントを出す時間
    var secondHintTime     = 60;
    // 3回目のヒントを出す時間
    var thirdHintTime      = 30;
    // ターンとターンの間のインターバルの秒数
    var intervalSecond     = 10;
    // チャットメッセージの長さ上限
    var messageLengthLimit = 100;

    /**
     * 部屋が満員かどうか
     */
    Room.prototype.isFull = function () {
      return this.players.length === this.playerCountMax;
    };

    /**
     * 部屋のプレイヤーが全員準備完了しているかどうか
     */
    Room.prototype.isReady = function () {
      for (var i = 0; i < this.players.length; i += 1) {
        if (!this.players[i].isReady) { return false; }
      }
      return true;
    };

    /**
     * client送信用のプレイヤー情報を取得する
     */
    Room.prototype.getPlayersInfo = function () {
      var players = [];
      for (var i = 0; i < this.players.length; i += 1) {
        var player = this.players[i];
        players.push({
          name:      escapeHTML(player.name),
          score:     player.score,
          isReady:   player.isReady,
          isPainter: i === this.painterIndex ? true : false
        });
      }
      return players;
    };

    /**
     * プレイヤー情報をroomに送信
     */
    Room.prototype.updateMember = function () {
      // this.log('update member');

      // TODO : room存在チェックは呼び出し側で
      // TODO : painter情報と正解、優勝者の情報は別に管理するか？要検討
      sockets.to(this.id).emit('update member', this.getPlayersInfo());
    };

    /**
     * プレイヤーの名前からplayersのindexを取得
     */
    Room.prototype.getPlayerIndex = function (playerName) {
      for (var i = 0; i < this.players.length; i += 1) {
        if (this.players[i].name === playerName) { return i; }
      }
      return -1;
    };

    /**
     * メッセージの長さチェック
     */
    Room.prototype.isValidMessage = function (message) {
      if (message.trim().length === 0 || message.length > messageLengthLimit) {
        return false;
      }
      return true;
    };

    /**
     * プレイヤーから送られてきたメッセージを処理
     */
    Room.prototype.procMessage = function (playerName, message) {
      this.log('[player:' + playerName + ']' + message);

      if (this.mode === 'turn') {
        // turn中は正解かどうかチェックする
        if(message.trim() === this.theme) {
          // 正解
          var playerIndex = this.getPlayerIndex(playerName);
          if (this.players[this.painterIndex].name === playerName) {
            this.pushSystemMessage('ネタバレダメ。ゼッタイ。');
            return;
          }

          sockets.to(this.id).emit('push chat', { playerName: escapeHTML(playerName), message: escapeHTML(message) });

          var player = this.players[playerIndex];
          var painter = this.players[this.painterIndex];
          player.score += this.timeLeft;
          painter.score += this.timeLeft;
          this.sendTheme(9);
          this.pushSystemMessage('正解は ' + this.theme + ' でした');
          this.pushSystemMessage('正解した ' + player.name + ' さんに ' + this.timeLeft + ' 点加算されます');
          this.pushSystemMessage('描いた ' + painter.name + ' さんに ' + this.timeLeft + ' 点加算されます');
          this.endTurn();
        } else {
          // 不正解
          sockets.to(this.id).emit('push chat', { playerName: escapeHTML(playerName), message: escapeHTML(message) });
        }
      } else {
        sockets.to(this.id).emit('push chat', { playerName: escapeHTML(playerName), message: escapeHTML(message) });
      }
    };

    /**
     * システムメッセージを送信する
     */
    Room.prototype.pushSystemMessage = function (message) {
      this.log('[system]' + message);

      sockets.to(this.id).emit('push system message', escapeHTML(message));
    };

    /**
     * 送られてきた描画データを処理する
     */
    Room.prototype.procImage = function (data, playerName) {
      if (data.lenght === 1 && data[0].type === 'fill') {
        this.imagelog.length = 0;
        this.imagelog.push(data);
      } else {
        this.imagelog.push(data);
      }

      // 通信量削減のため描いた人には送らない
      for (var i = 0; i < this.players.length; i += 1) {
        if (this.players[i].name !== playerName) {
          this.players[i].socket.emit('push image', data);
        }
      }
    };

    /**
     * 残り時間を送信する
     */
    Room.prototype.sendTimeLeft = function () {
      sockets.to(this.id).emit('send time left', this.timeLeft);
    };

    /**
     * お題とヒントを送る
     */
    Room.prototype.sendTheme = function (level) {
      // this.log('send theme');

      this.lastHint = Dictionary.getHint(this.theme, level);
      for (var i = 0; i < this.players.length; i += 1) {
        if (i === this.painterIndex) {
          // painterには最初の1回だけ送れば十分
          if (level === 0) {
            this.players[i].socket.emit('send theme', this.theme);
          }
        } else {
          this.players[i].socket.emit('send theme', this.lastHint);
        }
      }
    };

    /**
     * プレイヤーがpainterかどうかを送る
     */
    Room.prototype.sendIsPainter = function () {
      // this.log('send painter');

      for (var i = 0; i < this.players.length; i += 1) {
        if (i === this.painterIndex) {
          this.players[i].socket.emit('send is painter', true);
        } else {
          this.players[i].socket.emit('send is painter', false);
        }
      }
    };

    /**
     * timerで呼び出される処理
     */
    Room.prototype.timerProc = function () {
      // this.log('mode:' + this.mode + ' time:' + this.timeLeft);

      switch(this.mode) {
      // お絵描きチャットモード
      case 'chat':
        // なにもしない
        break;

      // 準備完了 ゲーム開始カウントダウン
      case 'ready':
        this.timeLeft -= 1;
        if (this.timeLeft === 0) {
          this.initGame();
          this.startTurn();
        } else {
          this.sendTimeLeft();
        }
        break;

      // ターン中
      case 'turn':
        this.timeLeft -= 1;
        if (this.timeLeft === 0) {
          // 時間切れでターン終了
          this.endTurn();
        } else {
          this.sendTimeLeft();
          if (this.timeLeft === firstHintTime) {
            this.sendTheme(1);
          } else if (this.timeLeft === secondHintTime) {
            this.sendTheme(2);
          } else if (this.timeLeft === thirdHintTime) {
            this.sendTheme(3);
          }
        }
        break;

      // ターンとターンの間
      case 'interval':
        this.timeLeft -= 1;
        if (this.timeLeft === 0) {
          // ターン開始
          this.startTurn();
        } else {
          this.sendTimeLeft();
        }
        break;

      // 該当なし ありえないケース
      default:
        throw new Error('不正なmodeです mode:' + this.mode);
      }
    };

    /**
     * ゲーム開始時の初期化処理
     */
    Room.prototype.initGame = function () {
      // this.log('init game');

      // TODO : 場所検討
      for (var i = 0; i < this.players.length; i += 1) {
        this.players[i].score = 0;
      }
      this.updateMember();

      this.round = 1;
      this.turn = 0;
      this.painterIndex = 0;
      this.lastHint = null;
      this.pushSystemMessage('ゲームを開始します');
    };

    /**
     * ターン開始処理
     */
    Room.prototype.startTurn = function () {
      // this.log('start turn');

      this.mode = 'turn';
      this.turn += 1;
      this.timeLeft = turnSecond;
      this.theme = this.dictionary.getNextWord();
      sockets.to(this.id).emit('change mode', 'turn');
      sockets.to(this.id).emit('clear canvas');
      this.imagelog.length = 0;
      if (this.painterIndex === 0) {
        this.pushSystemMessage('ラウンド ' + this.round + ' を開始します');
      }
      this.pushSystemMessage('ターン ' + this.turn + ' を開始します');
      this.sendIsPainter();
      this.sendTimeLeft();
      this.sendTheme(0);
    };

    /**
     * ターン終了処理
     */
    Room.prototype.endTurn = function () {
      // this.log('end turn');

      if (this.timeLeft === 0) {
        this.pushSystemMessage('時間切れです');
        this.pushSystemMessage('正解は ' + this.theme + ' でした');
      }

      if (this.painterIndex === this.players.length - 1) {
        // round終了
        if (this.round === this.roundMax) {
          // ゲーム終了
          this.pushSystemMessage('ゲームが終了しました');

          var maxScore = 0;
          var winnerIndex = [];
          for (var i = 0; i < this.players.length; i += 1) {
            if (this.players[i].score > maxScore) {
              maxScore = this.players[i].score;
              winnerIndex = [i];
            } else if (this.players[i].score === maxScore) {
              winnerIndex.push(i);
            }
          }

          if (maxScore === 0) {
            this.pushSystemMessage('もっとがんばりましょう');
          } else if (winnerIndex.length === 1) {
            this.pushSystemMessage('優勝は ' + this.players[winnerIndex[0]].name + ' さんでした');
          } else {
            var winners = '';
            for (var j = 0; j < winnerIndex.length; j += 1) {
              winners += this.players[winnerIndex[j]].name + ' さんと ';
            }
            winners = winners.substr(0, winners.length - 2);
            this.pushSystemMessage('優勝は同率で ' + winners + 'でした');
          }

          for (var k = 0; k < this.players.length; k += 1) {
            this.players[k].isReady = false;
          }
          this.changeModeChat();
        } else {
          // 次のroundに
          this.pushSystemMessage('ラウンド ' + this.round + ' が終了しました');
          this.round += 1;
          this.painterIndex = 0;
          this.pushSystemMessage('次に描く人は ' + this.players[this.painterIndex].name + ' さんです');
          this.changeModeInterval();
        }
      } else {
        // 次のturnに
        this.painterIndex += 1;
        this.pushSystemMessage('次に描く人は ' + this.players[this.painterIndex].name + ' さんです');
        this.changeModeInterval();
      }

      this.updateMember();
    };

    /**
     * モード変更 Chat
     */
    Room.prototype.changeModeChat = function () {
      // this.log('change mode chat');

      this.mode = 'chat';
      // this.pushSystemMessage('お絵描きチャットモード');
      sockets.to(this.id).emit('change mode', 'chat');
    };

    /**
     * モード変更 Ready
     */
    Room.prototype.changeModeReady = function () {
      // this.log('change mode ready');

      this.mode = 'ready';
      this.timeLeft = intervalSecond;
      this.pushSystemMessage(intervalSecond + ' 秒後にゲームを開始します');
      sockets.to(this.id).emit('change mode', 'ready');
    };

    /**
     * モード変更 Interval
     */
    Room.prototype.changeModeInterval = function () {
      // this.log('change mode interval');

      this.mode = 'interval';
      this.timeLeft = intervalSecond;
      this.pushSystemMessage(intervalSecond + ' 秒後に次のターンを開始します');
      sockets.to(this.id).emit('change mode', 'interval');
    };

    /**
     * player退出時の処理
     */
    Room.prototype.playerExit = function (playerName) {
      this.log('[exit]' + playerName);

      var exitPlayerIndex;
      for (exitPlayerIndex = 0; exitPlayerIndex < this.players.length; exitPlayerIndex += 1) {
        // TODO : 一致するユーザーがいない可能性はあるか？
        if (this.players[exitPlayerIndex].name === playerName) {
          break;
        }
      }

      // roomからプレイヤーを削除
      this.players.splice(exitPlayerIndex, 1);

      // 誰もいない
      if (this.players.length === 0) {
        return;
      }

      this.pushSystemMessage(playerName + ' さんが退室しました');

      // 残りプレイヤーが1人になったら強制的にゲーム終了
      if (this.players.length === 1 && this.mode !== 'chat') {
        this.pushSystemMessage('1人になってしまいました');
        this.pushSystemMessage('ゲームを続行できないのでゲームを終了します');
        this.players[0].isReady = false;
        this.changeModeChat();
        this.updateMember();
        return;
      }

      // ゲーム中ならゲーム進行を調整する
      if (this.mode === 'turn' || this.mode === 'interval') {
        if (exitPlayerIndex < this.painterIndex) {
          // painterより前のプレイヤーが退室
          // playersのindexが1つ前にずれるためpainterIndexも1つ減らす
          this.painterIndex -= 1;
        } else if (exitPlayerIndex === this.painterIndex) {
          this.painterIndex -= 1;
          if (this.mode === 'turn') {
            this.pushSystemMessage('描く人が退室したのでターンを終了します');
          } else {
            this.pushSystemMessage('次に描く予定の人が退室しました');
            this.pushSystemMessage('次に描く人は ' + this.players[this.painterIndex].name + ' さんです');
          }
          this.endTurn();
        } else {
          // painterより後のプレイヤーが退室してもゲーム進行には影響しない
        }
      } else if (this.mode === 'chat') {
        // TODO : 残ったプレイヤーが全員準備完了なら自動的readyに遷移する
        if (this.players.length >= 2 && this.isReady()) {
          // TODO : changeModeReadyとupdateMemberはどっちが先でも同じか？
          this.changeModeReady();
        }
      }

      this.updateMember();
    };

    /**
     * log出力メソッド
     */
    Room.prototype.log = function (message) {
      console.log('[room:' + this.name + ']' + message);
    };

    // TODO : app.jsでも使ってるので共通化する
    /**
     * HTMLエスケープ処理 
     */
    function escapeHTML (str) {
      return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return Room;
  })();

  exports.Room = Room;
})();
