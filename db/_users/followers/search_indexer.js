var _ = require('lodash');
var async = require('async');
var follow = require('follow');
var feed = new follow.Feed({});
var elasticsearch = require('elasticsearch');
var nano;
var es_client;


var DONT_INDEX_FIELDS = [
  '_rev',
  'immutable',
  'revisable',
  '_attachments'
]

feed.include_docs = true;

feed.on('change', function(change){
  var doc = change.doc;

  if (doc.type == 'user'){
    var user = doc;

    if (user.bookmarks){
      Object.keys(user.bookmarks).forEach(function(key){
        feed.emit('needs_updating', user.bookmarks[key].type, key)
      })
    }
  }
})



module.exports = feed;
