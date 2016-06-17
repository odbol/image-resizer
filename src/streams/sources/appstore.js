// Fetches an app icon from the Apple App Store

'use strict';

var stream, util, request;

var DEBUG = false;

stream  = require('stream');
util    = require('util');
request = require('request');

function contentLength(bufs){
  return bufs.reduce(function(sum, buf){
    return sum + buf.length;
  }, 0);
}

function AppStore(image, key){
  /* jshint validthis:true */
  if (!(this instanceof AppStore)){
    return new AppStore(image, key);
  }
  stream.Readable.call(this, { objectMode : true });
  this.image = image;
  this.ended = false;
  this.key = key;
  this.bundleId = image.image;

  if (DEBUG) {
    console.log('appstore ' + this.bundleId + ': ' + key, image);
  }
}

util.inherits(AppStore, stream.Readable);


/**
  Parses the App store JSON lookup, and returns the app icon URL through a callback.
*/
function findIconUrl(bundleId, cb) {
  var url = 'https://itunes.apple.com/lookup?bundleId=' + bundleId;

  request({
      url: url,
      json: true
    },
    function (error, response, json) {
      var img, app;
      
      if (DEBUG) {
        console.log('res', json);
      }

      if (!error && response.statusCode === 200) {
        app = (json.results && json.results[0]) || {};
        img = app.artworkUrl100 || app.artworkUrl512;

        if (DEBUG) {
          console.log('icon: ', img);
        }

        // jpg is supppppper crappy: change to PNG
        if (img) {
          img = img.replace(/\.jpg$/, '.png');
          cb(img);
        } else {
          cb(null, 'Invalid JSON response');
        }

      } else {
        cb(null, error || ('Error ' +response.statusCode));
      }
    });
}






AppStore.prototype._read = function(){
  var _this = this,
    imgStream,
    bufs = [];

  if ( this.ended ){ return; }

  // pass through if there is an error on the image object
  if (this.image.isError()){
    this.ended = true;
    this.push(this.image);
    return this.push(null);
  }

  findIconUrl(this.bundleId, function (url, err) {

    if (err) {
      _this.image.error = new Error(err);
      _this.ended = true;
      _this.push(_this.image);
      _this.push(null);
      return;
    }

    _this.image.log.time(_this.key);


    imgStream = request.get(url);
    imgStream.on('data', function(d){ bufs.push(d); });
    imgStream.on('error', function(err){
      _this.image.error = new Error(err);
    });
    imgStream.on('response', function(response) {
      if (response.statusCode !== 200) {
        _this.image.error = new Error('Error ' + response.statusCode + ':');
      }
    });
    imgStream.on('end', function(){
      _this.image.log.timeEnd(_this.key);
      if(_this.image.isError()) {
        _this.image.error.message += Buffer.concat(bufs);
      } else {
        _this.image.contents = Buffer.concat(bufs);
        _this.image.originalContentLength = contentLength(bufs);
      }
      _this.ended = true;
      _this.push(_this.image);
      _this.push(null);
    });
  });

};


module.exports = AppStore;