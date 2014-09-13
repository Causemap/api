


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
  _id: '_design/action',
  language: 'javascript',
  util: {
    response: 'exports.json_response = '+ json_response.toString()
  },
  updates: {
    mark_for_deletion: function(subject_doc, req){
      var json_response = require('util/response').json_response;

      var new_action = {
        _id: req.uuid,
        type: 'action',
        created_by: req.userCtx.name,
        creation_date: (new Date()).getTime(),
        immutable: true,
        subject: {
          _id: subject_doc._id,
          type: subject_doc.type
        },
        verb: 'marked_for_deletion'
      }

      return [new_action, json_response({
        ok: true,
        id: new_action._id
      })]
    }
    // unmark_for_deletion: function(subject_doc, req){
    //   var json_response = require('util/response').json_response;
    //   var body = JSON.parse(req.body);

    //   var new_action = {
    //     _id: req.uuid,
    //     type: 'action',
    //     created_by: req.userCtx.name,
    //     creation_date: (new Date()).getTime(),
    //     immutable: true,
    //     subject: {
    //       _id: subject_doc._id,
    //       type: subject_doc.type
    //     },
    //     verb: 'unmarked_for_deletion',
    //     _attachments: body._attachments
    //   }

    //   return [new_action, json_response({
    //     ok: true,
    //     id: new_action._id
    //   })]
    // }
  },
  validate_doc_update: function(new_doc, old_doc, user_context){
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

    var type = new_doc.type;

    if (type == "action"){
      var required_fields = [
        'immutable',
        'creation_date',
        'created_by',
        'subject',
        'verb'
      ]

      var allowed_keys = required_fields;
      var subject = new_doc.subject;

      var required_fields_for_subject = [
        'type',
        '_id'
      ]

      var allowed_subject_types = [
        'situation',
        'relationship'
      ]

      required_fields.forEach(function(required_field){
        required(
          new_doc.hasOwnProperty(required_field),
          "'"+ required_field +"' is required"
        )
      })

      required(
        typeof subject == 'object' && subject != null,
        "'subject' must be an object"
      )

      required_fields_for_subject.forEach(function(required_field_for_subject){
        required(
          subject.hasOwnProperty(required_field_for_subject),
          "'subject."+ required_field_for_subject +"' is required"
        )
      })

      required(
        allowed_subject_types.indexOf(subject.type) != -1,
        "'subject.type' is not supported");


      var verb = new_doc.verb;

      // if the change is made to a situation
      if (subject.type == 'situation'){
        var allowed_action_verbs = [
          'marked_for_deletion',
          'unmarked_for_deletion'
        ]

        required(
          allowed_action_verbs.indexOf(verb) != -1,
          "'"+ verb +"' is not supported for type "+ subject.type
        )
      }

      if (subject.type == 'relationship'){
        var allowed_action_verbs = [
          'marked_for_deletion',
          'unmarked_for_deletion'
        ]

        required(
          allowed_action_verbs.indexOf(verb) != -1,
          "'"+ verb +"' is not supported for type "+ subject.type
        )
      }

      restrict_keys(new_doc, allowed_keys);
    }
  },
  views: {
    by_subject: {
      map: function(doc){
        if (doc.type == 'action'){
          emit([
            doc.subject._id,
            doc.subject.type,
            doc.creation_date
          ], null);
        }
      },

      reduce: function(keys, values, rereduce){
        if (rereduce) return sum(values);
        return values.length;
      }
    }
  }
}
