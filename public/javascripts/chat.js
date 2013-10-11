(function () {
    // 'use strict';
    
    $(document).ready(function () {
        // 'use strict';
        
        //------------------------------
        // 変数
        //------------------------------
        
        // socketオブジェクト
        var socket;
        // お絵かきデータの定期送信用タイマーオブジェクト
        var timer;
        // お絵かきデータの送信間隔(ミリ秒)
        var setTimeoutMillisecond = 500;
        
        // お絵かきの変数
        // 描画する始点のX座標
        var startX;
        // 描画する始点のY座標
        var startY;
        // TODO : color/widthの初期化は別の場所でやる？
        // 描画する色
        var color = '#000000';
        // 描画する線の太さ
        var drawWidth = 2;
        // 描画中フラグ
        var drawFlag = false;
        // canvasオブジェクト
        var canvas = $('#mainCanvas').get(0);
        var brushCanvas = $('#brushSizeCanvas').get(0);
        // contextオブジェクト
        var context;
        var brushContext;
        // お絵かきデータのbuffer
        var buffer = [];
        // お絵かきデータ送信用のタイマーがセットされているか
        var buffering = false;
        
        // 保存とクリアの連打防止
        var saveClearEnabled = true;
        var saveClearInterval = 10000;
        
        // サムネイルのサイズ
        var thumbnailSize = 150;
        
        // 部屋接続数
        var userCount = 0;
        // 全体の接続数
        var globalUserCount = 0;
        
        //------------------------------
        // 準備
        //------------------------------
        
        // Canvas 対応確認
        if (!canvas.getContext) {
            alert('お使いのブラウザはCanvasに対応していません');
            return;
        } else {
            context = canvas.getContext('2d');
            brushContext = brushCanvas.getContext('2d');
        }
        
        // ブラシサイズ初期化
        $('#brushSizeRange').val(drawWidth);
        drawBrushSize();
        
        // パレット選択色初期化
        changePalletSelectedBorderColor();
        
        // Interactive Color Picker の初期化
        // TODO : 警告が出るのはなんとかならないか？
        // TODO : 開いた状態でパレットの選択を切り替えた場合の挙動をどうするか？モーダルにしてしまうか？
        fixGradientImg();
        new dragObject('arrows', 'hueBarDiv', arrowsLowBounds, arrowsUpBounds, arrowsDown, arrowsMoved, endMovement);
        new dragObject('circle', 'gradientBox', circleLowBounds, circleUpBounds, circleDown, circleMoved, endMovement);
        
        // TODO : このへんの初期化処理は最後に持っていくべきか？canvas対応確認さえできてれば↓通っても問題ないはず？
        // serverに接続
        socket = io.connect();
        
        //------------------------------
        // メッセージハンドラ定義
        //------------------------------
        
        /**
         * 接続できたら部屋のidを送って入室する
         */
        socket.on('connected', function () {
            'use strict';
            // console.log('connected');
            
            location.href.match(/\/oekakichat\/([0-9a-f]{32})\//);
            var id = RegExp.$1;
            // TODO : id チェック必要？
            
            // TODO : 操作不可は切断時も→f5更新を要求する（定期的？に切断と接続が繰り返されている？そうするとうまく動かないかも）
            
            socket.emit('enter room', id, function (res) {
                'use strict';
                // console.log('enter room');
                
                if (res.result === 'bad param') {
                    alert('不正なパラメータです');
                } else if (res.result === 'ok') {
                    clearCanvas();
                    for (var i = 0; i < res.data.length; i += 1) {
                        drawData(res.data[i]);
                    }
                } else {
                    alert('予期しないエラーです');
                }
            });
        });
        
        /**
         * お絵かきデータの差分を受け取る
         */
        socket.on('push image', function (data) {
            'use strict';
            // console.log('push image');
            
            drawData(data);
        });
        
        /**
         * 部屋への接続数を受け取る
         */
        socket.on('update user count', function (data) {
            'use strict';
            // console.log('update user count');
            
            userCount = data;
            $('#userCount').text(userCount + '/' + globalUserCount);
        });
        
        /**
         * 全体の接続数を受け取る
         */
        socket.on('update global user count', function (data) {
            'use strict';
            // console.log('update global user count');
            
            globalUserCount = data;
            $('#userCount').text(userCount + '/' + globalUserCount);
        });
        
        /**
         * canvasをクリアする
         */
        socket.on('push clear canvas', function () {
            'use strict';
            // console.log('push clear canvas');
            
            clearCanvas();
        });
        
        //------------------------------
        // Canvas イベントハンドラ
        //------------------------------
        
        /**
         * Canvas MouseDown イベント
         */
        $('#mainCanvas').mousedown(function (e) {
            'use strict';
            // console.log('mouse down');
            e.stopPropagation();
            
            if ($('#spuit').is(':checked')) {
                startX = Math.round(e.pageX) - $('#mainCanvas').offset().left;
                startY = Math.round(e.pageY) - $('#mainCanvas').offset().top;
                var spuitImage = context.getImageData(startX, startY, 1, 1);
                var r = spuitImage.data[0];
                var g = spuitImage.data[1];
                var b = spuitImage.data[2];
                color = 'Rgb(' + r +','+ g + ',' + b +')';
                
                $('#pallet>div.selectedColor').css('background-color', color);
                changePalletSelectedBorderColor();
            } else {
                drawFlag = true;
                startX = Math.round(e.pageX) - $('#mainCanvas').offset().left;
                startY = Math.round(e.pageY) - $('#mainCanvas').offset().top;
                var c = $('#brush').is(':checked') ? color : '#ffffff';
                drawPoint(startX, startY, drawWidth, c);
                pushBuffer('point', drawWidth, c, { x: startX, y: startY });
            }
        });
        
        /**
         * Canvas MouseMove イベント
         */
        $('#mainCanvas').mousemove(function (e) {
            'use strict';
            // console.log('mouse move');
            e.stopPropagation();
            
            if (drawFlag) {
                var endX = Math.round(e.pageX) - $('#mainCanvas').offset().left;
                var endY = Math.round(e.pageY) - $('#mainCanvas').offset().top;
                var c = $('#brush').is(':checked') ? color : '#ffffff';
                drawLine([startX, endX], [startY, endY], drawWidth, c);
                pushBuffer('line', drawWidth, c, { xs: startX, ys: startY, xe: endX, ye: endY });
                startX = endX;
                startY = endY;
            }
        });
        
        /**
         * Canvas MouseUp イベント
         */
        $('#mainCanvas').mouseup(function (e) {
            'use strict';
            // console.log('mouse up');
            e.stopPropagation();
            
            drawFlag = false;
        });
        
        /**
         * Canvas MouseLeave イベント
         */
        $('#mainCanvas').mouseleave(function (e) {
            'use strict';
            // console.log('mouse leave');
            e.stopPropagation();
            
            drawFlag = false;
        });
        
        /**
         * Canvas MouseEnter イベント
         */
        $('#mainCanvas').mouseenter(function (e) {
            'use strict';
            // console.log('mouse enter');
            e.stopPropagation();
            
            if (buttonIsDown(e)) {
                drawFlag = true;
                startX = Math.round(e.pageX) - $('#mainCanvas').offset().left;
                startY = Math.round(e.pageY) - $('#mainCanvas').offset().top;
                drawPoint(startX, startY, drawWidth, color);
                pushBuffer('point', drawWidth, color, { x: startX, y: startY });
            }
        });
        
        //------------------------------
        // その他 イベントハンドラ
        //------------------------------
        
        /**
         * 要素の選択をキャンセルする
         */
        // $('body').on('selectstart', function () {
        //     'use strict';
        //     // console.log('body selectstart');
        //     return false;
        // });
        // $('body').on('mousedown', function () {
        //     'use strict';
        //     // console.log('body mousedown');
        //     return false;
        // });
        
        // TODO : 太さ選択方法変わったら要らなくなる
        $('#brushSizeRange').on('mousedown', function (e) {
            'use strict';
            // console.log('#brushSizeRange mousedown');
            e.stopPropagation();
        });
        
        /**
         * パレットをクリックで色選択
         */
        $('#pallet>div').on('click', function (e) {
            'use strict';
            // console.log('#pallet>div click');
            e.stopPropagation();
            
            // TODO : 色選択中は無効にする？か色選択画面の元の色を同期させる
            // 黒白固定するならその対応も
            
            $('#pallet>div.selectedColor').removeClass('selectedColor');
            $(this).addClass('selectedColor');
            
            $('#pallet>div').css('border-color', $('#toolbar').css('background-color'));
            changePalletSelectedBorderColor();
            color = $(this).css('background-color');
        });
        
        /**
         * パレットをダブルクリックで Interactive Color Picker を表示
         */
        $('#pallet>div').on('dblclick', function (e) {
            // 'use strict';
            // console.log('#pallet>div dblclick');
            e.stopPropagation();
            
            // TODO : 黒白は固定する？
            
            $(this).css('background-color').match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
            $('.staticColorFixed').css('background-color', $(this).css('background-color'));
            currentColor = Colors.ColorFromRGB(RegExp.$1, RegExp.$2, RegExp.$3);
            colorChanged('box');
            
            // Interactive Color Picker の表示位置を調整
            var left = $('#pallet>div:first-child').offset().left;
            var top = $(this).offset().top + $(this).height() + 4;
            $('#cp').css('left', left);
            $('#cp').css('top', top);
            // Interactive Color Picker 表示
            $('#cp').css('display', '');
            
            // TODO : 選択中はフラグ立てる
            // フラグたってるときに他の色選択したら.staticColorFixedだけ更新
            // キャンバスクリックしたら描画せずに閉じる
            // 閉じるときにフラグ下ろす
            // がいいか？
        });
        
        /**
         * Interactive Color Picker 色を決定
         */
        $('#cpOK').on('click', function (e) {
            'use strict';
            // console.log('#cpOK click');
            e.stopPropagation();
            
            // TODO : エラー処理
            var red = parseInt($('#redBox').val(), 10).toString(16);
            var green = parseInt($('#greenBox').val(), 10).toString(16);
            var blue = parseInt($('#blueBox').val(), 10).toString(16);
            color = '#' + red + green + blue;
            
            $('#pallet>div.selectedColor').css('background-color', color);
            changePalletSelectedBorderColor();
            
            // Interactive Color Picker 非表示
            $('#cp').css('display', 'none');
        });
        
        /**
         * Interactive Color Picker キャンセル
         */
        $('#cpCancel').on('click', function (e) {
            'use strict';
            // console.log('#cpCancel click');
            e.stopPropagation();
            
            $('#cp').css('display', 'none');
        });
        
        /**
         * ペン 太さ変更
         */
        $('#brushSizeRange').on('change', function (e) {
            'use strict';
            // console.log('#width change');
            e.stopPropagation();
            
            // TODO : ときどき変更が反映されないことがある。　←→で変更した時と、つまみ以外をクリックしたとき
            // 後者はフォーカス外しても変化しないので致命的
            // キー入力でも即時反映されるようにするか、キー入力を無効化するか、
            // canvas内ドラッグでサイズ指定させるようにする？これやってみたい
            // タダの枠と●だけだとわかりにくいから「太」アイコンとくっつけてみるか？
            
            drawWidth = $('#brushSizeRange').val();
            drawBrushSize();
        });
        
        /**
         * 保存ボタンをクリック
         */
        $('#save').on('click', function (e) {
            'use strict';
            // console.log('#save click');
            e.stopPropagation();
            
            if (saveClearEnabled) {
                saveClearEnabled = false;
                setTimeout(function () {saveClearEnabled = true;}, saveClearInterval);
                socket.emit('save canvas', { png: getPng(), thumbnailPng: getThumbnailPng() });
            } else {
                alert('保存とクリアは' + saveClearInterval / 1000 + '秒に1回までです');
            }
        });
        
        /**
         * クリアボタンをクリック
         */
        $('#clear').on('click', function (e) {
            'use strict';
            // console.log('#clear click');
            e.stopPropagation();
            
            if (saveClearEnabled) {
                if (window.confirm(
                    '絵を保存してキャンバスをクリアしますか？\n' +
                    '他の人が描いているときは少し待って様子を見てください')) {
                    saveClearEnabled = false;
                    setTimeout(function () {saveClearEnabled = true;}, saveClearInterval);
                    socket.emit('clear canvas', { png: getPng(), thumbnailPng: getThumbnailPng() });
                }
            } else {
                alert('保存とクリアは' + saveClearInterval / 1000 + '秒に1回までです');
            }
        });
        
        /**
         * ログボタンをクリック
         */
        $('#log').on('click', function (e) {
            'use strict';
            // console.log('#log click');
            e.stopPropagation();
            
            alert('まだできてないよ(´・ω・｀)');
            // TODO : id設定
            // window.open('/oekakichat/log/[id]/???');
        });
        
        /**
         * ヘルプボタンをクリック
         */
        $('#help').on('click', function (e) {
            'use strict';
            console.log('#help click');
            e.stopPropagation();
            
            alert('まだできてないよ(´・ω・｀)');
            // TODO : help実装
            // window.open('/oekakichat/#help');
        });
        
        //------------------------------
        // 関数
        //------------------------------
        
        /**
         * マウス左クリック検出関数
         */
        function buttonIsDown (e) {
            'use strict';
            // console.log('buttonIsDown');
            
            if (e.buttons != null) {
                return e.buttons === 1;
            } else {
                return e.which > 0;
            }
        }
        
        /**
         * パレットの選択色の枠の色を設定する
         */
        function changePalletSelectedBorderColor () {
            'use strict';
            // console.log('changePalletBorderColor');
            
            var tempColor;
            $('#pallet>div.selectedColor').css('background-color').match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
            if (Number(RegExp.$1) + Number(RegExp.$2) + Number(RegExp.$3) < 383) {
                tempColor = '#ffffff';
            } else {
                tempColor = '#000000';
            }
            $('#pallet>div.selectedColor').css('border-color', tempColor);
        }
        
        /**
         * ブラシサイズ変更時に表示を更新する
         */
        function drawBrushSize () {
            'use strict';
            // console.log('drawBrushSize');
            
            brushContext.fillStyle = '#ffffff';
            brushContext.beginPath();
            brushContext.fillRect(0, 0, $('#brushSizeCanvas').width(), $('#brushSizeCanvas').height());
            brushContext.stroke();
            
            var offset = drawWidth % 2 === 0 ? 0 : 0.5;
            var x = 13 - offset;
            var y = 13 - offset;
            brushContext.strokeStyle = '#000000';
            brushContext.fillStyle = '#000000';
            brushContext.lineCap = 'round';
            brushContext.lineWidth = drawWidth;
            brushContext.beginPath();
            brushContext.moveTo(x, y);
            brushContext.lineTo(x, y);
            brushContext.stroke();            
        }
        
        /**
         * 受け取ったお絵かきデータを描画メソッドに振り分ける
         */
        function drawData (data) {
            'use strict';
            // console.log('drawData');
            
            for (var i = 0; i < data.length; i += 1) {
                var width = data[i].width;
                var color = data[i].color;
                var x = data[i].x;
                var y = data[i].y;
                for (var j = 0; j < x.length; j += 1) {
                    if (x[j].length === 1) {
                        drawPoint(x[j][0], y[j][0], width, color);
                    } else {
                        drawLine(x[j], y[j], width, color);
                    }
                }
            }
        }
        
        /**
         * Canvas 線分を描画する
         */
        function drawLine (x, y, width, color) {
            'use strict';
            console.log('drawLine');
            
            var offset = drawWidth % 2 === 0 ? 0 : 0.5;
            context.strokeStyle = color;
            context.fillStyle = color;
            context.lineCap = 'round';
            context.lineWidth = width;
            context.beginPath();
            context.moveTo(x[0] - offset, y[0] - offset);
            for (var i = 1; i < x.length; i += 1) {
                context.lineTo(x[i] - offset, y[i] -offset);
            }
            context.stroke();
        }
        
        /**
         * Canvas 点を描画する
         */
        function drawPoint (x, y, width, color) {
            'use strict';
            // console.log('drawPoint');
            
            var offset = drawWidth % 2 === 0 ? 0 : 0.5;
            context.strokeStyle = color;
            context.fillStyle = color;
            context.lineCap = 'round';
            context.lineWidth = width;
            context.beginPath();
            context.moveTo(x - offset, y - offset);
            context.lineTo(x - offset, y - offset);
            context.stroke();
        }
        
        /**
         * Canvas クリア
         */
        function clearCanvas () {
            'use strict';
            // console.log('#clearCanvas');
            
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, $('#mainCanvas').width(), $('#mainCanvas').height());
        }
        
        /**
         * お絵かき情報をbufferに溜める
         */
        function pushBuffer (type, width, color, data) {
            'use strict';
            // console.log('pushBuffer');
            
            if (buffer.length > 0 &&
                buffer.slice(-1)[0].width === width &&
                buffer.slice(-1)[0].color === color) {
                if (type === 'line') {
                    buffer.slice(-1)[0].x.slice(-1)[0].push(data.xe);
                    buffer.slice(-1)[0].y.slice(-1)[0].push(data.ye);
                } else if (type === 'point') {
                    buffer.slice(-1)[0].x.push( [data.x] );
                    buffer.slice(-1)[0].y.push( [data.y] );
                }
            } else {
                if (type === 'line') {
                    buffer.push({
                        width: width,
                        color: color,
                        x: [ [data.xs, data.xe] ],
                        y: [ [data.ys, data.ye] ] });
                } else if (type === 'point') {
                    buffer.push({
                        width: width,
                        color: color,
                        x: [ [data.x] ],
                        y: [ [data.y] ] });
                }
            }
            
            if (!buffering) {
                // console.log('buffering');
                
                buffering = true;
                timer = setTimeout(function () { sendImage(); }, setTimeoutMillisecond);
            }
        }
        
        /**
         * bufferを送信する
         */
        function sendImage () {
            'use strict';
            // console.log('sendImage');
            
            socket.emit('send image', buffer);
            buffer.length = 0;
            buffering = false;
        }
        
        /**
         * 画像DataUrl取得メソッド
         */
        function getPng () {
            'use strict';
            // console.log('getPng');
            
            var dataUrl = canvas.toDataURL('image/png');
            return dataUrl.split(',')[1];
        }
        
        /**
         * サムネイル画像DataUrl取得メソッド
         */
        function getThumbnailPng () {
            'use strict';
            // console.log('getThumbnailPng');
            
            var thumbnailCanvas = document.createElement('canvas');
            
            var rate;
            if (canvas.width >= canvas.height) {
                rate = canvas.width / thumbnailSize;
                thumbnailCanvas.width = thumbnailSize;
                thumbnailCanvas.height = Math.floor(canvas.height / rate);
            } else {
                rate = canvas.height / thumbnailSize;
                thumbnailCanvas.width = Math.floor(canvas.width / rate);
                thumbnailCanvas.height = thumbnailSize;
            }
            
            var thumbnailContext = thumbnailCanvas.getContext('2d');
            thumbnailContext.drawImage(canvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
            
            var dataUrl = thumbnailCanvas.toDataURL('image/png');
            return dataUrl.split(',')[1];
        }
    });
})();
