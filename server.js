/* jshint node:true */
'use strict';
var fs = require('fs');
var ffmpeg = require('fluent-ffmpeg');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var path = require('path');
app.use(bodyParser.json({
  limit: "500mb"
}));

var filePathBase = __dirname + '/data/';

app.get('/', function (request, response) {
  response.send('Hello world!');
});

app.get('/data/:file', function (request, response) {
  //serve something
  var pathname = filePathBase + request.params.file;
  serveStatic(response, pathname);
});

app.post('/upload', function (request, response) {
  upload(response, request.body);
});

var server = app.listen(3200, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Desktop Capture app listening on http://%s:%s', host, port);
});

function upload(response, postData) {
  var files = postData;

  // return an internal error if there are no files to process.
  if (!files.audio && !files.video) {
    response.sendStatus(500);
  }

  if (files.audio) {
    _upload(response, files.audio);
  }
  if (files.video) {
    _upload(response, files.video);
  }

  merge(response, files);
}

function merge(response, files) {
  if (files.audio) {
    var audioFile = filePathBase + files.audio.name;
  }
  var videoFile = filePathBase + files.video.name;
  var outputFileName = files.video.name.split('.').shift() + '-output.webm';
  var outputFile = filePathBase + outputFileName;
  if (fs.existsSync(audioFile)) {
    ffmpeg(videoFile)
      .input(audioFile)
      .on('error', function (err) {
        console.log('Cannot process video: ' + err.message);
        clean(audioFile, videoFile);
      })
      .on('start', function (commandLine) {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })
      .on('end', function () {
        console.log('end fired');
        response.send(outputFileName);
        clean(audioFile, videoFile);
        console.log('Sent and cleaned.');
      })
      .output(outputFile).run();
  } else if (fs.existsSync(videoFile)) {
    ffmpeg(videoFile)
      .on('error', function (err) {
        console.log('Cannot process video: ' + err.message);
        clean(audioFile, videoFile);
      })
      .on('start', function (commandLine) {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })
      .on('end', function () {
        console.log('end fired');
        clean(videoFile);
        response.send(outputFileName);
      })
      .output(outputFile).run();
  } else {
    response.sendStatus(500);
  }

}

function clean(audioFile, videoFile) {
  if (fs.existsSync(audioFile)) {
    fs.unlink(audioFile);
  }
  if (fs.existsSync(videoFile)) {
    fs.unlink(videoFile);
  }
}

function _upload(response, file) {
  var fileRootName = file.name.split('.').shift();
  var fileExtension = file.name.split('.').pop();
  var filePath = filePathBase + fileRootName + '.' + fileExtension;
  var fileId = 2
  var fileBuffer;

  while (fs.existsSync(filePath)) {
    filePath = fileRootName + fileRootName + '(' + fileId + ').' + fileExtension;
    fileId += 1;
  }

  // we can only write the file if it has contents.
  if (file.contents) {
    file.contents = file.contents.split(',').pop();

    fileBuffer = new Buffer(file.contents, "base64");

    // file system...
    fs.writeFileSync(filePath, fileBuffer);
  }
}


function serveStatic(response, pathname) {

  var extension = pathname.split('.').pop(),
    extensionTypes = {
      'js': 'application/javascript',
      'webm': 'video/webm',
      'gif': 'image/gif'
    };

  response.writeHead(200, {
    'Content-Type': extensionTypes[extension]
  });

  response.end(fs.readFileSync(pathname));
}