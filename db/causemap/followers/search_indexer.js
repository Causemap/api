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


feed.on('indexed', function(){
  if (feed.is_paused) return feed.resume();
})


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
    async.parallel([
      function(parallel_cb){
        db.view_with_list(
          'situation',
          'history',
          'current',
          {
            startkey: [ doc_id ],
            endkey: [ doc_id, {} ]
          }, function(list_error, list_result){
            if (list_error) return parallel_cb(list_error, null);
            return parallel_cb(null, list_result)
          }
        )
      },
      function(parallel_cb){
        // count the relationships
        return parallel_cb(null, {})
      }
    ], function(parallel_error, parallel_results){
      if (parallel_error) return feed.emit('error', parallel_error);

      var situation = {};

      parallel_results.map(function(parallel_result){
        situation = _.extend(situation, parallel_result)
      })

      return feed.emit(
        'needs_indexing',
        'situations',
        'situation',
        situation
      )
    })
  }

  if (doc_type == 'relationship'){
    // read the relationship, get the cause and effect
    db.view_with_list(
      'relationship',
      'history',
      'current',
      {
        startkey: [ doc_id ],
        endkey: [ doc_id, {} ]
      }, function(list_error, relationship_list_result){
        if (list_error) return feed.emit('error', list_error);

        var relationship_types = ['cause', 'effect'];

        relationship_types.forEach(function(relationship_type){
          var rel = {}
          rel[relationship_type] = relationship_list_result[relationship_type];

          if(!relationship_list_result[relationship_type]._id) return;

          feed.emit(
            'needs_updating',
            'situation',
            relationship_list_result[relationship_type]._id
          )
        })

        return async.map(
          relationship_types,
          function(relationship_type, map_cb){
            // get the cause
            db.view_with_list(
              'situation',
              'history',
              'current',
              {
                startkey: [ relationship_list_result[relationship_type]._id ],
                endkey: [ relationship_list_result[relationship_type]._id, {} ]
              }, function(list_error, list_result){
                if (list_error) return map_cb(list_error, null);

                var relationship_result = {};
                relationship_result[relationship_type] = list_result;
                return map_cb(null, relationship_result)
              }
            )
          },
          function(map_error, map_results){
            if (map_error) return feed.emit('error', map_error);

            var relationship = relationship_list_result;

            map_results.map(function(map_result){
              relationship = _.extend(relationship, map_result)
            })

            return feed.emit(
              'needs_indexing',
              'relationships',
              'relationship',
              relationship
            )
          }
        )
      }
    )
  }
})


feed.on('change', function(change){
  feed.pause();
  var doc = change.doc;

  if (doc.type == 'change'){
    feed.emit(
      'needs_updating',
      doc.changed.doc.type,
      doc.changed.doc._id
    )

    feed.emit(
      'needs_indexing',
      'changes',
      [ doc.changed.doc.type, doc.changed.field.name, 'change' ].join('.'),
      doc
    )

    if (doc.changed.doc.type == 'situation'){
      // get the relationships
      var db = nano.use(feed.master_db)

      db.view(
        'relationship',
        'by_cause_or_effect',
        {
          startkey: [ doc.changed.doc._id ],
          endkey: [ doc.changed.doc._id, {} ],
          reduce: false
        },
        function(view_error, view_result){
          if (view_error) return feed.emit('error', view_error);

          view_result.rows.forEach(function(view_result_row){
            feed.emit('needs_updating', 'relationship', view_result_row.id)
          })
        }
      )
    }
  }

  if (doc.type == 'relationship'){
    feed.emit(
      'needs_updating',
      'relationship',
      doc._id
    )
  }
})



module.exports = feed;
