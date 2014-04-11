var express = require('express'),
    app = express(),
    http = require('http'),
    server = http.createServer(app),
    io = require('socket.io').listen(server),
    fs = require('fs'),
    url = require('url'),
    q = require('q'),
    gm = require('gm'),
    request = require('request'),
    path = require('path'),
    btoa = require('btoa'),
    midi = require('midi');

var lastMsg = -1;
var beatIndex = 0;
var beatKey = 0;
var beatListen = true;

var input = new midi.input();

input.openVirtualPort("Giftastic");

input.ignoreTypes(false, false, false);

function exitHandler(options, err) {
  input.closePort();
  process.exit();
}

process.on('SIGINT', exitHandler.bind(null));

server.listen(3000);

io.sockets.on('connection', function (socket) {
  socket.on('changeGif', function (data) {
    io.sockets.emit('changeGif', data);
  });
  socket.on('pingPong', function (data) {
    io.sockets.emit('pingPong', data);
  });
});

app.use(express.logger('short'));
app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));

app.get('/api/gifs', function (req, res) {
  fs.readFile('gifs.txt', 'utf-8', function (err, content) {
    if (err) {
      res.send(500, err);
      return;
    }
    res.json({gifs: JSON.parse(content || '[]')});
  });
});

app.put('/api/gifs', function (req, res) {
  fs.writeFile('gifs.txt', JSON.stringify(req.body.gifs), 'utf-8', function (err, content) {
      if (err) {
        res.send(500, err);
        return;
      }
      io.sockets.emit('listUpdate', req.body);
      res.json(req.body);
  });
});

app.get('/api/gifPoster', function (req, res) {
  var parsedUrl = url.parse(decodeURIComponent(req.query.path));

  var filepath = path.join(__dirname, 'posters', btoa(req.query.path) + '.jpg');

  res.sendfile(filepath, function (err) {
    if (err) {
      if (!parsedUrl.host) {
        parsedUrl.host = 'localhost:3000';
      }

      if (!parsedUrl.protocol) {
        parsedUrl.protocol = 'http:';
      }

      gm(request.get(url.format(parsedUrl)), path.basename(parsedUrl.pathname))
      .stream('jpg', function (err, stdout, stderr) {
        if (err) {
          res.send(500, err);
        }
        stdout.pipe(res);
        stdout.pipe(fs.createWriteStream(filepath));
      });
    }
  });

});

var lastBeat;

input.on('message', function (deltaTime, message) {
  if (+message === 248) {
    beatKey++;

    if (beatKey % 24 === 0) {
      if (lastBeat) {
        io.sockets.emit('beat', {
          duration: (Date.now() - lastBeat),
          index: beatIndex++,
          time: Date.now()
        });
      }
      lastBeat = Date.now();
    }
  }
});