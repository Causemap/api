


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
  _id: '_design/situation',
  language: 'javascript',
  util: {
    response: 'exports.json_response = '+ json_response.toString()
  },
  updates: {
    create: function(doc, req){
      var json_response = require('util/response').json_response;
      var new_situation = {
        _id: req.uuid,
        created_by: req.userCtx.name,
        creation_date: (new Date()).getTime(),
        type: 'situation',
        immutable: true,
        revisable: true
      }

      return [new_situation, json_response({
        ok: true,
        id: new_situation._id
      })]
    },
    name_retroactively: function(doc, req){
      doc.name = JSON.parse(req.body).given_name;
      return [doc, 'done'];
    }
  },
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

    if (new_doc.type == 'situation'){
      var required_fields = [
        'immutable',
        'revisable',
        'creation_date',
        'created_by'
      ]

      required_fields.forEach(function(required_field){
        required(
          new_doc.hasOwnProperty(required_field),
          "'"+ required_field +"' is required"
        )
      })

      if (!user_is('_admin')){
        restrict_keys(new_doc, required_fields);
      }
    }
  },
  views: {
    history: {
      map: function(doc){
        if (doc.type == 'change' && doc.changed.doc.type == 'situation'){
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

        if (doc.type == 'action' && doc.subject.type == 'situation'){
          var value = {};

          if (['tagged', 'untagged'].indexOf(doc.verb) != -1){
            value[doc.verb] = doc.tag_name;

            return emit(
              [ doc.subject._id, 'tags', doc.creation_date ],
              value
            )
          } else {
            value[doc.verb] = doc.creation_date;
          }

          emit(
            [ doc.subject._id, doc.verb, doc.creation_date ],
            value
          )
        }

        if (doc.type == 'situation'){
          emit(
            [doc._id, 0, doc.creation_date],
            doc
          )
        }
      }
    },
    aliased: {
      map: function(doc){
        if (doc.type == 'change'){
          var changed = doc.changed;

          if (
            changed.doc.type == 'situation'
            && changed.field.name == 'alias'
          ){
            emit([changed.field.to, doc.creation_date], changed.doc._id);
          }
        }
      }
    }
  },
  lists: {
    current: function(head, req){
      provides('json', function(){
        var current_version = {
          tags: [],
          total_changes: -2
        };
        var row;

        while(row = getRow()){
          current_version.total_changes++

          Object.keys(row.value).forEach(function(key){
            if (key == 'tagged'){
              if (current_version.tags.indexOf(row.value[key]) == -1){
                return current_version.tags.push(row.value[key]);
              }
            }

            if (key == 'untagged'){
              if (current_version.tags.indexOf(row.value[key]) != -1){
                return current_version.tags.splice(
                  current_version.tags.indexOf(row.value[key]),
                  1
                )
              }
            }

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
