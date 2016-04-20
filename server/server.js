var net = require('net');
var osUtils  = require('os-utils');
var free = require('freem');

// config
var fs = require('fs')
var configFile = __dirname + '/config.json'
var config = JSON.parse(fs.readFileSync(configFile));

/*
  Web server 
*/
var express = require('express');
var app = express();
var server = require('http').createServer(app);

// json api
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
var router = express.Router();
// routes
router.route('/config')
  .get(function (req, res) {
    res.json(config);
  })
  .post(function (req, res) {
    config = req.body;
    fs.writeFile(configFile, JSON.stringify(config, null, 4), function (err) {
      if (err) 
        res.send(err);
      res.json("Config successfully saved.");
    });
  });
router.route('/config/:param')
  .get(function (req, res) {
    res.json(config[req.params.param]);
  });
// system variables
router.route('/env')
  .get(function (req, res) {
    res.json(process.env);
  });
router.route('/env/:param')
  .get(function (req, res) {
    res.json(process.env[req.params.param]);
  });
app.use('/api', router);

// redirect everything to index.html
var path = require('path');
app.use(express.static(path.resolve(__dirname, '../bin')));
app.get('/', function (req, res) {
  res.redirect('/index.html');
});

app.post('/cpu', function (req, res) {
  osUtils.cpuUsage(function(v){
    try {
      res.send(Math.floor(v * 100) + '%');
    } catch(err) {
      res.send('?');
    }
  });
});

app.post('/ram', function (req, res) {
  free.m(function (err, data) {
    try {
      if (err) return res.send('?');
      var ramTotal = data[0].total;
      var ramFree = Number(data[0].buffers) + Number(data[0].free);
      res.send(ramTotal + '/' + ramFree);
    } catch(err) {
      res.send('?');
    }
  });
});

server.listen(80, function () {
  console.log('Web server listening at http://%s:%s', 
    server.address().address, server.address().port);
});

process.on('uncaughtException', function(err) {
    process.stderr.write("\nuncaughtException\n");
    process.stderr.write(err.stack);
    process.exit();
});
