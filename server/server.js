/*
  This proxy translate TCP to Unix domain sockets 
  For check Unix domain socket use: 
    echo -e "GET /info HTTP/1.1\r\n" | nc -U /var/run/docker.sock
  For check TCP socket use:
    curl -s -XGET http://<PROXY_HOST>:<PROXY_PORT>/info
*/
var net = require('net');

var PROXY_PORT = 8000;
var DOCKER_SOCKET = '/docker.sock';

// create tcp server
net.createServer(function (socket) {
  // get msg request from tcp client
  socket.on('data', function (msg) {
    // create connection to unix server
    var serviceSocket = new net.Socket();
    serviceSocket.connect(DOCKER_SOCKET, function () {
      // when connection established write msg responce to unix server
      serviceSocket.write(msg);
    });
    // get data request from unix server
    serviceSocket.on('data', function (data) {
      // modify header to enable CORS
      var cors_enable = '\r\nAccess-Control-Allow-Headers: Content-Type';
      cors_enable += '\r\nAccess-Control-Allow-Methods: GET, POST, DELETE';
      cors_enable += '\r\nAccess-Control-Allow-Origin: *';
      var separator = '\r\n\r\n';
      cors_enable += separator;
      data = data.toString().replace(separator, cors_enable);
      // write tcp response
      socket.write(data.toString());
    });
  });
}).listen(PROXY_PORT, function () {
  console.log('TCP proxy server listening at %s port', PROXY_PORT);
});

/*
  This web server translate all request to index.html 
*/
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);

app.use(express.static(path.resolve(__dirname, '../build')));

app.get('*', function (req, res) {
  res.sendFile(path.resolve(__dirname, '../build', 'index.html'));
});

server.listen(80, function () {
  console.log('Web server listening at http://%s:%s', 
    server.address().address, server.address().port);
});