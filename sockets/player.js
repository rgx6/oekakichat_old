(function () {
  'use strict';

  /**
   * コンストラクタ 
   */
  var Player = (function () {
    function Player (name, isReady, socket) {
      this.name      = name;
      this.score     = 0;
      this.isReady   = isReady;
      this.socket    = socket;
    }

    return Player;
  })();

  exports.Player = Player;
})();
