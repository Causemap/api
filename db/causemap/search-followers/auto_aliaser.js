var EventEmitter = require('events').EventEmitter;
var utils = require('../../utils');
var nano = require('nano');
var aliaser = new EventEmitter();
var slugify = utils.slugify;



aliaser.on('start', function(){
  nano = nano(aliaser.dburl);
})

aliaser.on('indexed', function(
  index_name,
  type,
  indexed_doc
){
  if (type == 'situation'){
    if (indexed_doc.hasOwnProperty('alias')) return;
    if (
      indexed_doc.hasOwnProperty('name')
      && indexed_doc.hasOwnProperty('location')
      && indexed_doc.hasOwnProperty('period')
    ){
      var db = nano.use(aliaser.dbname);
      var alias = [
        indexed_doc.name,
        indexed_doc._id.split('').splice(indexed_doc._id.length -6, 6)
      ].map(slugify).join('--')

      // give this situation an auto-alias
      db.atomic(
        'situation',
        'default_alias',
        indexed_doc._id,
        { given_alias: alias },
        function(error, response){
          if (error) return aliaser.emit('error', error);
          return aliaser.emit('auto_aliased', indexed_doc, alias)
        }
      )
    }
  }
})



module.exports = aliaser;
