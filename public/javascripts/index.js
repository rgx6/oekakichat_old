(function () {
    'use strict';
    
    var socket;
    
    // TODO : domから取得
    var nameLengthLimit = 0;
    var widthMin = 0;
    var widthMax = 0;
    var heightMin = 0;
    var heightMax = 0;
    
    // 存在チェック
    if (String.prototype.format == undefined) {
        /**
         * フォーマット関数
         */
        String.prototype.format = function(arg)
        {
            // 置換ファンク
            var rep_fn = undefined;
            // オブジェクトの場合
            if (typeof arg == "object") {
                rep_fn = function(m, k) { return arg[k]; }
            }
            // 複数引数だった場合
            else {
                var args = arguments;
                rep_fn = function(m, k) { return args[ parseInt(k) ]; }
            }
            return this.replace( /\{(\w+)\}/g, rep_fn );
        }
    }

    $(document).ready(function () {
        'use strict';
        console.log('ready');
        
        socket = io.connect();
        
        //------------------------------
        // メッセージハンドラ定義
        //------------------------------
        
        socket.on('connected', function () {
            'use strict';
            console.log('connected');
        });
        
        //------------------------------
        // イベントハンドラ定義
        //------------------------------
        
        /**
         * 部屋作成依頼
         */
        $('#create-room').on('click', function () {
            'use strict';
            console.log('create-room click');
            
            // TODO : パラメータチェック
            // main,index,jadeで設定を共通できる？websocketでserverから取得もありか？
            
            var req = {
                name:   $('#room-name').val(),
                width:  $('#room-width').val(),
                height: $('#room-height').val()
            };
            
            socket.emit('create room', req, function (res) {
                'use strict';
                console.log('create room');
                
                if (res.result === 'bad param') {
                    alert('不正なパラメータです');
                } else if (res.result === 'ok') {
                    // TODO : ちゃんと表示する
                    $('#result').text(res.result);
                    $('#id').text(res.id);
                    var url = location.href + res.id + '/';
                    $('#url').text(url);
                    $('#configid').text(res.configid);
                    var configurl = location.href + 'config/' + res.configid + '/';
                    $('#configurl').text(configurl);
                    // TODO : ツールバーの分があるからサイズの指定をどうするか要検討
                    var tag = '<iframe src="{0}" style="border:1px solid #ffffff" width="{1}" height="{2}" />'
                              .format(url, res.height, res.width);
                    $('#tag').text(tag);
                    $('#loglisturl').text(url + 'log/list/');
                } else {
                    alert('予期しないエラーです');
                }
            });
        });
    });
})();
