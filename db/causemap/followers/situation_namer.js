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
  if (change.doc.type != 'situation') return;

  var situation = change.doc;
  var db = nano.use(feed.db_name);

  if (situation.name) return;

  // get the first name it was given
  db.view(
    'situation',
    'history',
    {
      startkey: [ situation._id, 'name' ],
      endkey: [ situation._id, 'name', {}],
      limit: 1
    },
    function(error, result){
      if (error) return feed.emit('error', error);
      if (result.rows.length == 0) return feed.emit('noname', situation);

      var given_name = result.rows[0].value.name;

      situation.name = given_name;

      db.atomic(
        'situation',
        'name_retroactively',
        situation._id,
        { given_name: given_name },
        function(error, response){
          if (error) return feed.emit('error', error);
          feed.emit('named_retroactively', situation, given_name);
        }
      )
    }
  )
})



module.exports = feed;
