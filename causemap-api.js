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
  .action(function(program){
    var nano = require('nano')(program.couchdbUrl);
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

    nano.db.create('causemap', function(error, result){
      if (error && error.error != 'file_exists'){
        // if creation fails for any other reason, throw an error
        return installation_callback(error, null);
      }

      var causemap_db = nano.use('causemap');

      async.parallel([
        function(callback){
          var security_doc = require('./db/causemap/security');

          return causemap_db.insert(
            security_doc,
            '_security',
            function(error, result){
              if (error) return installation_callback(error, null);

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
        if (error) return installation_callback(error, null);

        return installation_callback(null, result);
      })
    })
  });

program.parse(process.argv);
