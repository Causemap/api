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
  'created_by'
]


function indexable(doc){
  DONT_INDEX_FIELDS.forEach(function(field_not_to_index){
    delete doc[field_not_to_index];
  })

  return doc
}


feed.include_docs = true;

feed.on('start', function(){
  nano = require('nano')(feed.db_host);
  es_client = elasticsearch.Client({
    host: feed.es_host
  })
});


feed.on('needs_indexing', function(index_name, type, doc){

  var indexable_doc = indexable(_.clone(doc));

  if (indexable_doc.type == 'relationship'){
    var relationship_types = ['cause', 'effect'];
    relationship_types.map(function(relationship_type){
      indexable_doc[relationship_type] = indexable(
        indexable_doc[relationship_type]
      )
    })
  }

  if (!indexable_doc._id){
    // don't index it if the base id wasn't read yet
    return
  }

  es_client.index({
    index: index_name,
    type: type,
    id: indexable_doc._id,
    body: indexable_doc
  }, function(error, result){
    if (error) return feed.emit('error', error);
    return feed.emit('indexed', index_name, type, indexable_doc)
  })
})


feed.on('needs_updating', function(doc_type, doc_id){
  var db = nano.use(feed.master_db)

  if (doc_type == 'situation'){
    db.view_with_list(
      'situation',
      'history',
      'current',
      {
        startkey: [ doc_id ],
        endkey: [ doc_id, {} ]
      },
      function(err, result){
        if (err) return feed.emit('error', err);

        console.log(result)
        feed.emit('needs_indexing', 'situations', 'situation', result)
      }
    )
  }
})


feed.on('change', function(change){
  var doc = change.doc;

  if (doc.type == 'change'){
    feed.emit(
      'needs_updating',
      doc.changed.doc.type,
      doc.changed.doc._id
    )
  }
})



module.exports = feed;


