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


function indexable(doc){
  DONT_INDEX_FIELDS.forEach(function(field_not_to_index){
    delete doc[field_not_to_index];
  })

  return doc
}

function read_situation(db, doc_id, callback){
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
      db.view(
        'bookmark',
        'by_subject',
        {
          startkey: [ doc_id ],
          endkey: [ doc_id, {} ]
        },
        function(error, result){
          if (error) return parallel_cb(error, null);
          if (!result.rows.length) return parallel_cb(
            null, { total_bookmarks: 0 }
          )

          return parallel_cb(null, { total_bookmarks: result.rows[0].value })
        }
      )
    },
    function(parallel_cb){
      // count the relationships
      async.map(['cause', 'effect'], function(rel_type, map_cb){
        var q = {
          index: 'relationships',
          type: 'relationship',
          size: 0,
          body: {
            query: {
              filtered: {
                filter: {
                  bool: {
                    must_not: [
                      { exists: { field: 'marked_for_deletion' } }
                    ],
                    must: {
                      term: {},
                    }
                  }
                }
              }
            }
          }
        }

        q.body.query.filtered.filter.bool.must_not.push({
          exists: {
            field: (rel_type == 'cause' ? 'effect' : 'cause') +'.marked_for_deletion'
          }
        })

        q.body.query.filtered.filter.bool.must.term[rel_type +'._id'] = doc_id;

        es_client.search(q).then(function(result){
          var return_me = {};

          return_me[
            'total_'+ (rel_type == 'cause' ? 'effects' : 'causes')
          ] = result.hits.total;

          return map_cb(null, return_me)
        }, function(error){
          return map_cb(error, null)
        })
      }, function(map_error, map_results){
        if (map_error){
          return parallel_cb(map_error, null)
        }

        var parallel_result = {};

        map_results.forEach(function(result){
          parallel_result = _.extend(parallel_result, result)
        })

        return parallel_cb(null, parallel_result)
      })
    }
  ], function(parallel_error, parallel_results){
    if (parallel_error) return callback(parallel_error, null);

    var situation = {};

    parallel_results.map(function(parallel_result){
      situation = _.extend(situation, parallel_result)
    })

    return callback(null, situation)
  })
}


feed.include_docs = true;
feed.update_queue = {};

feed.on('start', function(){
  nano = require('nano')(feed.db_host);
  es_client = elasticsearch.Client({
    requestTimeout: 600000,
    sniffOnConnectionFault: true,
    host: feed.es_host
  })
});


feed.on('unindexed', function(index_name, type, unindexed_doc){
  if (unindexed_doc.type == 'relationship'){
    // update situations
    feed.emit('needs_updating', 'situation', unindexed_doc.cause._id);
    feed.emit('needs_updating', 'situation', unindexed_doc.effect._id);
  }
})


feed.on('needs_unindexing', function(indexed_doc){

  if (indexed_doc.type == 'relationship'){

    return async.parallel([
      function(parallel_cb){

        // unindex changes
        es_client.search({
          index: 'changes',
          type: 'change',
          body: {
            query: {
              filtered: {
                filter: {
                  term: {
                    'changed.doc._id': indexed_doc._id
                  }
                }
              }
            }
          }
        }, function(error, result){
          if (error) return parallel_cb(error, null);
          result.hits.hits.forEach(function(hit){
            feed.emit('needs_unindexing', hit._source)
            return parallel_cb(null, { unindexing: 'changes' })
          })
        })
      },
      function(parallel_cb){

        // unindex relationship
        es_client.delete({
          index: 'relationships',
          type: 'relationship',
          id: indexed_doc._id
        }, function(error, result){
          if (error) return parallel_cb(error, null);
          feed.emit('unindexed', 'relationships', 'relationship', indexed_doc)
          return parallel_cb(null, { unindexed: 'relationship' })
        })
      }
    ], function(error, results){
      if (error) return feed.emit('error', error);
    })
  }

  if (indexed_doc.type == 'change'){
    // update the changed doc
    feed.emit('needs_updating', indexed_doc.changed.doc);

    return es_client.delete({
      index: 'changes',
      type: 'change',
      id: indexed_doc._id
    }, function(error, result){
      if (error) return feed.emit('error', error);
      feed.emit('unindexed', 'changes', 'change', indexed_doc)
    })
  }

  if (indexed_doc.type == 'situation'){
    return async.parallel([
      function(parallel_cb){
        // unindex all changes and relationships
        es_client.search({
          index: '_all',
          body: {
            query: {
              filtered: {
                filter: {
                  or: [
                    { term: { 'changed.doc._id': indexed_doc._id } },
                    { term: { 'cause._id': indexed_doc._id } },
                    { term: { 'effect._id': indexed_doc._id } }
                  ]
                }
              }
            }
          }
        }, function(error, result){
          if (error) return parallel_cb(error, null);
          result.hits.hits.forEach(function(hit){
            feed.emit('needs_unindexing', hit._source)
          })

          return parallel_cb(null, { unindexing: 'changes and relationships' })
        })
      },
      function(parallel_cb){
        // unindexing the actual situation
        es_client.delete({
          index: 'situations',
          type: 'situation',
          id: indexed_doc._id
        }, function(error, result){
          if (error) return parallel_cb(error, null);
          feed.emit('unindexed', 'situations', 'situation', indexed_doc)
          return parallel_cb(null, { unindexed: 'situation' })
        })
      }
    ], function(error, results){
      if (error) return feed.emit('error', error);
    })
  }
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

  if (indexable_doc.type == 'situation'){
    indexable_doc.tag_suggest = {
      input: indexable_doc.tags.slice(0, indexable_doc.tags.length -1)
    }
  }

  es_client.index({
    index: index_name,
    type: type,
    id: indexable_doc._id,
    body: indexable_doc
  }, function(error, result){
    if (error) return feed.emit('error', error);
    return feed.emit('indexed', index_name, type, indexable_doc, result)
  })
})


feed.on('indexed', function(index_name, type, indexed_doc, result){
  if (indexed_doc.type == 'relationship'){
    if (result.created){
      // update the cause and effect situations
      feed.emit('needs_updating', 'situation', indexed_doc.cause._id)
      feed.emit('needs_updating', 'situation', indexed_doc.effect._id)
    }
  }
})


feed.on('catchup', function(){
  feed.emit('consuming_update_queue', Object.keys(feed.update_queue).length);

  // consume the update queue
  Object.keys(feed.update_queue).map(function(arg_string){
    return JSON.parse(arg_string)
  }).forEach(function(arg_array){
    feed.emit('needs_updating', arg_array[0], arg_array[1]);
  })
})


feed.on('needs_updating', function(doc_type, doc_id){
  if (!feed.caught_up){
    var serialized_args = JSON.stringify(arguments);
    feed.emit('update_queued', serialized_args);

    // queue the things that need updating
    return feed.update_queue[serialized_args] = arguments;
  }

  var db = nano.use(feed.master_db)

  if (doc_type == 'situation'){
    async.parallel([
      function(parallel_cb){
        read_situation(db, doc_id, parallel_cb)
      },
      function(parallel_cb){
        // update the relationships
        db.view(
          'relationship',
          'by_cause_or_effect',
          {
            startkey: [ doc_id ],
            endkey: [ doc_id, {} ],
            reduce: false
          },
          function(view_error, view_result){
            if (view_error) return parallel_cb(list_error, null);

            view_result.rows.forEach(function(row){
              feed.emit('needs_updating', 'relationship', row.id);
            })

            return parallel_cb(null, {})
          }
        )
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

        if (!relationship_list_result.hasOwnProperty('_id')) return

        var relationship_types = ['cause', 'effect'];

        return async.map(
          relationship_types,
          function(relationship_type, map_cb){
            // get the situation
            read_situation(
              db,
              relationship_list_result[relationship_type]._id,
              function(error, situation){
                if (error) return map_cb(error, null);

                var relationship_result = {};
                relationship_result[relationship_type] = situation;
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
  // handle deleted documents

  var doc = change.doc;

  if (change.deleted){
    var query = {
      "query": {
        "filtered": {
          "filter": {
            "term": {
              "_id": change.id
            }
          }
        }
      }
    }

    if (doc.type == 'bookmark'){
      feed.emit('needs_updating', doc.subject.type, doc.subject._id);
    }

    return es_client.search({
      index: '_all',
      body: query
    }, function(error, result){
      if (error) return feed.emit('error', error);
      if (!result.hits.hits.length) return;

      var indexed_doc = result.hits.hits.length ? result.hits.hits[0]._source : null;

      if (indexed_doc){
        return feed.emit('needs_unindexing', indexed_doc);
      }
    })
  }

  if (doc.type == 'situation' && doc.name){
    feed.emit('needs_updating', 'situation', doc._id);
  }

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
  }

  if (doc.type == 'action'){
    feed.emit(
      'needs_updating',
      doc.subject.type,
      doc.subject._id
    )

    feed.emit(
      'needs_indexing',
      'actions',
      [ doc.subject.type, doc.verb, 'action' ].join('.'),
      doc
    )
  }

  if (doc.type == 'bookmark'){
    feed.emit(
      'needs_updating',
      doc.subject.type,
      doc.subject._id
    )

    feed.emit(
      'needs_indexing',
      'bookmarks',
      'bookmark',
      doc
    )
  }

  if (doc.type == 'adjustment'){
    feed.emit(
      'needs_updating',
      doc.adjusted.doc.type,
      doc.adjusted.doc._id
    )
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
