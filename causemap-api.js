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
    var followers = require('./db/causemap/followers');
    var auto_aliaser = require('./db/causemap/search-followers/auto_aliaser');

    var errorReporter = function errorReporter(source_name){
      return function(error){
        util.log(source_name +' error');
        console.log(error);
      }
    }

    Object.keys(followers).forEach(function(follower_key){
      var follower = followers[follower_key];

      follower.es_host = program.elasticsearchUrl;
      follower.db_host = program.couchdbUrl;
      follower.on('error', errorReporter(follower_key));
    })

    followers.search_indexer.db = program.couchdbUrl +'/causemap';
    followers.search_indexer.master_db = 'causemap';

    auto_aliaser.dburl = followers.search_indexer.db;
    auto_aliaser.dbname = followers.search_indexer.master_db;

    auto_aliaser.on('auto_aliased', function(doc, alias){
      util.log('auto-aliased: '+ alias)
    })

    followers.search_indexer.on('change', function(){
      util.log('change');
    })

    followers.search_indexer.on('indexed', function(
      index_name,
      type,
      indexed_doc
    ){
      util.log('indexed: '+ indexed_doc._id +' in '+ index_name +' ('+ type +')')
    })

    followers.search_indexer.on('indexed', function(
      index_name,
      type,
      indexed_doc
    ){
      return auto_aliaser.emit('indexed', index_name, type, indexed_doc);
    })

    followers.search_indexer.on('unindexed', function(
      index_name,
      type,
      unindexed_doc
    ){
      util.log('unindexed: '+ unindexed_doc._id +' in '+ index_name +' ('+ type +')')
    })

    followers.situation_namer.db = program.couchdbUrl +'/causemap';
    followers.situation_namer.on('noname', function(situation){
      util.log('situation without name: '+ situation._id);
    })

    followers.situation_namer.on('named_retroactively', function(situation, name){
      util.log('named retroactively: '+ situation._id +', '+ name)
    })

    Object.keys(followers).forEach(function(key){
      followers[key].follow();
    })
    auto_aliaser.emit('start');
  })


program.parse(process.argv);
