var setupAudioSynching = function (xGif) {
  var playing = false;
  var beats = [];
  var numFakes = 0;
  var avgDrift = 0;
  var driftCount = 0;
  var driftSum = 0;
  function beatParser (data) {
    var sentTime = data.time;
    var current = Date.now();
    var drift = current - sentTime;
    driftSum += drift;
    driftCount += 1;
    avgDrift = driftSum / driftCount;
    data.time = sentTime + avgDrift;
    beats.push(data);
  }

  if (window.opener.lastBeat()) {
    beatParser(window.opener.lastBeat());
  }
  window.addEventListener('message', function (e) {
    var split = e.data.split('|');
    if (split[0] === 'beat') {
      beatParser(JSON.parse(split[1]));
    }
    if (split[0] === 'reflow') {
      xGif.relayout();
    }
    if (split[0] === 'pingPong') {
      var expected = split[1] ? true : null;
      if (xGif['ping-pong'] !== expected) {
        console.log(xGif['ping-pong'], expected);
        xGif.togglePingPong();
      }
      console.log("PING PONG", xGif['ping-pong']);
    }
  });

  var beat = {
    time: 0
  };

  function currentTime() {
    return Date.now();
  }

  function makeFraction(b) {
    return (currentTime() - b.time) / b.duration;
  }

  function clearFakes() {
    setTimeout(clearFakes, 20000);
    numFakes = 0;
  }
  clearFakes();

  var animationLoop = function () {
    var newBeat = beats.shift();

    requestAnimationFrame(animationLoop);

    if (newBeat) {
      if (newBeat.time <= currentTime()) {
        beat = newBeat;
      } else {
        beats.unshift(newBeat);
      }
    }

    if (beat) {
      var beatFraction = makeFraction(beat);
      xGif.clock(beat.index, beat.duration, beatFraction);
    }
  };

  animationLoop();
};