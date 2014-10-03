


var toJSON = JSON.stringify;

function json_response(obj){
  return {
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(obj)
  }
}


module.exports = {
  _id: '_design/relationship',
  language: 'javascript',
  util: {
    response: 'exports.json_response = '+ json_response.toString()
  },
  updates: {
    create: function(doc, req){
      var body = JSON.parse(req.body);
      var json_response = require('util/response').json_response;
      var new_relationship = {
        _id: [body.cause_id, 'caused', body.effect_id].join(':'),
        created_by: req.userCtx.name,
        creation_date: (new Date()).getTime(),
        type: 'relationship',
        immutable: true,
        revisable: true,
        cause: { _id: body.cause_id },
        effect: { _id: body.effect_id }
      }

      return [new_relationship, json_response({
        ok: true,
        id: new_relationship._id
      })]
    }
  },
  validate_doc_update: function(new_doc, old_doc, user_context){

    function required(be_true, message){
      if (!be_true) throw { forbidden: message };
    }

    function unchanged(field) {
      if (old_doc && toJSON(old_doc[field]) != toJSON(new_doc[field]))
        throw({ forbidden : "Field can't be changed: " + field });
    }

    var type = new_doc.hasOwnProperty('type') ? new_doc.type : undefined;

    if (type == 'relationship'){
      required(
        new_doc.hasOwnProperty('cause'),
        "Relationships must have a 'cause' field.");

      required(
        new_doc.cause.hasOwnProperty('_id'),
        "'cause' must have an '_id' field.");

      required(
        typeof new_doc.cause._id == 'string',
        "'cause._id' must be a string.");

      required(
        new_doc.hasOwnProperty('effect'),
        "Relationships must have a 'effect' field.");

      required(
        new_doc.effect.hasOwnProperty('_id'),
        "'effect' must have an '_id' field.");

      required(
        typeof new_doc.effect._id == 'string',
        "'effect._id' must be a string.");

      var relationship_id = [
        new_doc.cause._id,
        'caused',
        new_doc.effect._id
      ].join(':');

      required(
        new_doc.hasOwnProperty('_id') && new_doc._id == relationship_id,
        "'_id' must be "+ relationship_id
      )
    }
  },
  views: {
    history: {
      map: function(doc){
        if (doc.type == 'change' && doc.changed.doc.type == 'relationship'){
          var value = {};
          value[doc.changed.field.name] = doc.changed.field.to;

          emit(
            [
              doc.changed.doc._id,
              doc.changed.field.name,
              doc.creation_date
            ], value
          )
        }

        if (doc.type == 'action' && doc.subject.type == 'relationship'){
          var value = {};
          value[doc.verb] = doc.creation_date;

          emit(
            [ doc.subject._id, doc.verb, doc.creation_date ],
            value
          )
        }

        if (doc.type == 'relationship'){
          emit(
            [doc._id, 0, doc.creation_date],
            doc
          )
        }
      }
    },
    by_cause_or_effect: {
      map: function(doc){
        if (doc.type == 'relationship'){
          emit([ doc.cause._id, 'cause' ], null);
          emit([ doc.effect._id, 'effect' ], null);
        }
      },

      reduce: function(keys, values, rereduce){
        if (rereduce) return sum(values);
        return values.length;
      }
    },
    by_cause_and_effect: {
      map: function(doc){
        if (doc.type == 'relationship'){
          emit([doc.cause._id, doc.effect._id], null);
        }
      }
    }
  },
  lists: {
    current: function(head, req){
      provides('json', function(){
        var current_version = {
          total_changes: -2
        };
        var row;

        while(row = getRow()){
          current_version.total_changes++

          Object.keys(row.value).forEach(function(key){
            current_version[key] = row.value[key];
          })
        }

        if (
          current_version.marked_for_deletion &&
          current_version.unmarked_for_deletion
        ){
          if (
            current_version.marked_for_deletion > current_version.unmarked_for_deletion
          ){
            delete current_version.unmarked_for_deletion;
          } else {
            delete current_version.marked_for_deletion;
          }
        }

        return JSON.stringify(current_version)
      })
    }
  }
}
