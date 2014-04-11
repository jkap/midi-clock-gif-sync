/*global angular, io*/
(function () {
  "use strict";
  angular.module("Giftastic", []);

  angular.module("Giftastic").controller("GridController", function ($scope, $window, $sce, $http) {
    var avgDrift, driftCount, driftSum, gifNr, lastBeat, socket, windows;

    avgDrift = 0;
    driftCount = 0;
    driftSum = 0;
    gifNr = 0;
    windows = [];
    $scope.gifs = [];


    function beatParser (data) {
      var current, drift, sentTime;

      sentTime = data.time;
      current = Date.now();
      drift = current - sentTime;
      driftSum += drift;
      driftCount += 1;
      avgDrift = driftSum / driftCount;
      data.time = sentTime + avgDrift;
      lastBeat = data;
      windows.forEach(function (newWindow) {
        sendBeat(newWindow, data);
      });
    }

    function changeGif (newWindow) {
      newWindow.postMessage('src|' + $sce.getTrustedResourceUrl($scope.currentGif.url), '*');
      var pingPongMessage = 'pingPong';
      if ($scope.currentGif.pingPong) {
        pingPongMessage += '|true';
      }
      newWindow.postMessage(pingPongMessage, '*');
    }

    function sendBeat(newWindow, beat) {
      newWindow.postMessage('beat|' + JSON.stringify(beat), '*');
    }

    function splitIntoRows(array, groupSize) {
      var output = [];
      array.forEach(function (value, index) {
        if (index % groupSize === 0) {
          var temp = [];
          for (var i = 0; i < groupSize; i++) {
            if (array[index + i]) {
              temp.push(array[index + i]);
            }
          }
          output.push(temp);
        }
      });
      return output;
    }

    function cleanGif(gif) {
      return {
        url: $sce.getTrustedResourceUrl(gif.url),
        pingPong: gif.pingPong
      };
    }

    function trustGif(gif) {
      return {
        url: $sce.trustAsResourceUrl(gif.url),
        pingPong: gif.pingPong
      };
    }

    function cleanArray(array) {
      return array.map(cleanGif);
    }

    function trustArray(array) {
      return array.map(trustGif);
    }

    $scope.nextGif = function () {
      gifNr = (gifNr + 1) % $scope.gifs.length;
      $scope.currentGif = $scope.gifs[gifNr];
      windows.forEach(changeGif);
    }

    $scope.openWindow = function () {
      var newWindow;
      newWindow = window.open('http://' + window.location.host + '/slave.html', null, "dialog=yes");
      windows.push(newWindow);
    };

    $scope.setActiveGif = function (gif, index, skipSocket) {
      $scope.currentGif = gif;
      gifNr = index;
      if (!skipSocket) {
        socket.emit('changeGif', cleanGif($scope.currentGif));
      }
      windows.forEach(changeGif);
    };

    $scope.addGif = function () {
      $scope.gifs.push({
        url: $sce.trustAsResourceUrl($scope.gifInput),
        pingPong: false
      });
      $scope.gifInput = "";
      $http.put('/api/gifs', {gifs: cleanArray($scope.gifs)});
    };

    $scope.reflowWindows = function () {
      windows.forEach(function (newWindow) {
        newWindow.postMessage('reflow', '*');
      });
    };

    $scope.removeGif = function (gif) {
      var index = $scope.gifs.indexOf(gif);

      while (index > -1) {
        $scope.gifs.splice(index, 1);
        index = $scope.gifs.indexOf(gif);
      }

      $http.put('/api/gifs', {gifs: cleanArray($scope.gifs)});
    }

    $window.currentGif = function () {
      return $scope.currentGif;
    };

    $window.lastBeat = function () {
      return lastBeat;
    };

    $scope.$watch("gifs", function (value) {
      if (value) {
        $scope.gifRows = splitIntoRows(value, 4);
      }
    }, true);

    $http.get('/api/gifs').then(function (resp) {
      $scope.gifs = trustArray(resp.data.gifs);
      $scope.currentGif = $scope.gifs[gifNr];
    });

    function sendPingPong(value, skipSocket) {
      var pingPongMessage;

      pingPongMessage = 'pingPong';
      if (value) {
        pingPongMessage += '|true';
      }
      if (!skipSocket) {
        socket.emit('pingPong', !!value);
      }
      windows.forEach(function (newWindow) {
        newWindow.postMessage(pingPongMessage, '*');
      });
      $http.put('/api/gifs', {gifs: cleanArray($scope.gifs)});
    }

    $scope.$watch("currentGif.pingPong", function (value) {
      var pingPongMessage;
      if ($scope.currentGif) {
        sendPingPong(value);
      }
    });


    socket = io.connect('http://' + $window.location.host);

    socket.on('beat', beatParser);
    socket.on('changeGif', function (data) {
      $scope.setActiveGif(trustGif(data), null, true);
    });
    socket.on('pingPong', function (data) {
      sendPingPong(data, true);
    });
    socket.on('listUpdate', function (data) {
      $scope.$apply(function () {
        $scope.gifs = trustArray(data.gifs);
      });
    });
  });

  angular.module("Giftastic").filter("poster", function () {
    return function (url) {
      return '/api/gifPoster?path=' + encodeURIComponent(url);
    };
  });
}());