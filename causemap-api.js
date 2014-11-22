#!/usr/bin/env node



var program = require('commander');
var util = require('util');



program
  .version(require('./package').version)


program.command('install')
  .description('Insert the API designs into CouchDB')
  .option(
    '-l --couchdb-url <url>',
    'CouchDB URL [http://localhost:5984]',
    'http://localhost:5984')
  .option(
    '-s --elasticsearch-url <url>',
    'Elasticsearch URL [http://localhost:9200]',
    'http://localhost:9200')
  .action(function(program){
    var nano = require('nano')(program.couchdbUrl);
    var elasticsearch_client = new require('elasticsearch').Client({
      host: program.elasticsearchUrl
    })
    var async = require('async');

    var insert_or_update = require('./db/utils').insert_or_update;

    // called at the very end of installation
    var installation_callback = function(error, result){
      if (error){
        util.log('Error');
        console.log(error);

        // TODO: it may be a good idea to abort the installation here. undo all
        // chnages if possible.

        process.exit(1);
      }

      util.log('Installed.')
      process.exit();
    }

    async.parallel([
      function(parallel_cb){
        nano.db.create('causemap', function(error, result){
          if (error && error.error != 'file_exists'){
            // if creation fails for any other reason, throw an error
            return parallel_cb(error, null);
          }

          var causemap_db = nano.use('causemap');

          async.parallel([
            function(callback){
              var security_doc = require('./db/causemap/security');

              return causemap_db.insert(
                security_doc,
                '_security',
                function(error, result){
                  if (error) return parallel_cb(error, null);

                  return callback(null, result)
                }
              );
            },
            function(callback){
              var fixtures = require('./db/causemap/fixtures');

              return async.map(fixtures, function(fixture, map_callback){
                insert_or_update(causemap_db, fixture, map_callback);
              }, callback);
            }
          ], function(error, result){
            if (error) return parallel_cb(error, null);

            return parallel_cb(null, result);
          })
        })
      },
      function(parallel_cb){
        // install elasticsearch index mappings
        var mappings = require('./search/mappings');

        async.map(
          Object.keys(mappings),
          function(index_name, map_cb){
            // check if it exists
            elasticsearch_client.indices.exists(
              { index: index_name },
              function(error, exists){
                if (error) return map_cb(error, null);
                if (exists) return map_cb(null, { index_exists: exists });

                // create the index
                elasticsearch_client.indices.create({
                  index: index_name,
                  body: mappings[index_name]
                }, function(error, result){
                  if (error) return map_cb(error, null);
                  return map_cb(null, { created: index_name, result: result })
                })
              }
            )
          },
          function(error, result){
            if (error) return parallel_cb(error, null);
            return parallel_cb(null, result)
          }
        )
      }
    ], installation_callback)
  });


program.command('run')
  .description('Run the API server')
  .option(
    '-l --couchdb-url <url>',
    'CouchDB URL [http://localhost:5984]',
    'http://localhost:5984')
  .option(
    '-s --elasticsearch-url <host>',
    'Elasticsearch Host (eg. http://localhost:9200)',
    'http://localhost:9200')
  .action(function(program){
    var cm_followers = require('./db/causemap/followers');

    var errorReporter = function errorReporter(source_name){
      return function(error){
        util.log(source_name +' error');
        console.log(error);
      }
    }

    Object.keys(cm_followers).forEach(function(cm_follower_key){
      var cm_follower = cm_followers[cm_follower_key];

      cm_follower.es_host = program.elasticsearchUrl;
      cm_follower.db_host = program.couchdbUrl;
      cm_follower.on('error', errorReporter(cm_follower_key));
    })

    cm_followers.search_indexer.db = program.couchdbUrl +'/causemap';

    cm_followers.search_indexer.master_db = 'causemap';

    var queued = 0;
    cm_followers.search_indexer.on('update_queued', function(){
      queued++;
    })

    cm_followers.search_indexer.on('consuming_update_queue', function(len){
      util.log('consuming update queue: '+ len +' items from '+ queued +' calls');
    })

    cm_followers.search_indexer.on('indexed', function(
      index_name,
      type,
      indexed_doc
    ){
      util.log('indexed: '+ indexed_doc._id +' in '+ index_name +' ('+ type +')')
    })

    cm_followers.search_indexer.on('unindexed', function(
      index_name,
      type,
      unindexed_doc
    ){
      util.log('unindexed: '+ unindexed_doc._id +' in '+ index_name +' ('+ type +')')
    })

    cm_followers.situation_namer.db = program.couchdbUrl +'/causemap';
    cm_followers.period_parser.db = program.couchdbUrl +'/causemap';
    cm_followers.default_created_by.db = program.couchdbUrl +'/causemap';
    cm_followers.situation_namer.on('noname', function(situation){
      util.log('situation without name: '+ situation._id);
    })

    cm_followers.period_parser.on('period_parsed', function(change, new_value){
      util.log('period parsed: '+ change._id +', '+ JSON.stringify(new_value))
    })

    cm_followers.default_created_by.on('set_default_created_by', function(id){
      util.log('default created_by: '+ id)
    })

    cm_followers.period_parser.on('couldnt_parse', function(change, new_value){
      util.log('couldn\'t parse: '+ change._id +', '+ new_value.text);
    })

    cm_followers.situation_namer.on('named_retroactively', function(situation, name){
      util.log('named retroactively: '+ situation._id +', '+ name)
    })

    Object.keys(cm_followers).forEach(function(key){
      cm_followers[key].follow();
    })
  })


program.parse(process.argv);
