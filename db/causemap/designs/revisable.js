


var toJSON = JSON.stringify;


module.exports = {
  _id: '_design/revisable',
  language: 'javascript',
  validate_doc_update: function(new_doc, old_doc, user_context){

    if (new_doc._deleted){
      return
    }

    function required(be_true, message){
      if (!be_true) throw { forbidden: message };
    }

    function unchanged(field) {
      if (old_doc && toJSON(old_doc[field]) != toJSON(new_doc[field]))
        throw({ forbidden : "Field can't be changed: " + field });
    }

    function user_is(role){
      return user_context.roles.indexOf(role) >= 0;
    }

    function restrict_keys(obj, keys){
      var fields = keys;
      fields.push('_id', '_rev', 'type', '_revisions');

      var obj_keys = Object.keys(obj);

      for (i in obj_keys){
        if (fields.indexOf(obj_keys[i]) == -1){
          throw({ forbidden: '"'+ obj_keys[i] +'" is not allowed.' })
        }
      }
    }

    if (new_doc.hasOwnProperty('revisable')){
      required(
        new_doc.revisable === true,
        "'revisable' may only be set to 'true'.");
    }
  },
  views: {
    changes_by_changed: {
      map: function (doc) {
        if (doc.type == 'change'){
          emit([
            doc.changed.doc._id,
            doc.changed.field.name,
            doc.creation_date
          ], doc.changed.field)
        }
      },

      reduce: function(keys, values, rereduce){
        if(rereduce){ return values[0] }
        var key = keys[0];
        var id = key[key.length -1]
        return id;
      }
    },
    total_changes: {
      map: function(doc){
        if (doc.type == 'change'){
          emit([ doc.changed.doc._id, doc.changed.field.name ], null)
        }
      },

      reduce: function(keys, values, rereduce){
        if (rereduce) return sum(values);
        return values.length;
      }
    }
  }
}
