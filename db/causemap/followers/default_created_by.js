var _ = require('lodash');
var async = require('async');
var follow = require('follow');
var feed = new follow.Feed({});
var elasticsearch = require('elasticsearch');
var nano;
var es_client;


feed.include_docs = true;

feed.on('start', function(){
  nano = require('nano')(feed.db_host);
  es_client = elasticsearch.Client({
    sniffOnConnectionFault: true,
    host: feed.es_host
  })
});

feed.on('change', function(change){
  if (change.deleted) return;

  var doc = change.doc;

  if (!doc.hasOwnProperty('created_by')) return;
  if (doc.created_by != null) return;

  var db = nano.use('causemap');

  // get the first name it was given
  db.atomic(
    'all',
    'set_default_created_by',
    doc._id,
    function(error, result){
      if (error) return feed.emit('error', error);
      return feed.emit('default_created_by', doc._id);
    }
  )
})



module.exports = feed;
