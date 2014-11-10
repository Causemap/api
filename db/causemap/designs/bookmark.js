


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
  _id: '_design/bookmark',
  language: 'javascript',
  util: {
    response: 'exports.json_response = '+ json_response.toString()
  },
  shows: {
    has_bookmark: function(bookmark, req){
      return {
        body: toJSON({
          has_bookmark: !!bookmark,
          type: bookmark ? bookmark.type : undefined,
          id: req.id.split(':')[1]
        }),
        headers: {
          "Content-Type": "application/json"
        }
      }
    }
  },
  updates: {
    bookmark: function(bookmark, req){
      var json_response = require('util/response').json_response;

      if (bookmark){
        return [bookmark, json_response({ ok: true })]
      }

      var subject = req.id.split('.')[req.id.split('.').length -1];
      subject = {
        type: subject.split(':')[0],
        _id: subject.split(':')[1]
      }

      var new_bookmark = {
        _id: req.id,
        type: 'bookmark',
        created_by: req.userCtx.name,
        creation_date: (new Date()).getTime(),
        subject: {
          _id: subject._id,
          type: subject.type
        }
      }

      return [new_bookmark, json_response({ ok: true })]
    },
    unbookmark: function(bookmark, req){
      var json_response = require('util/response').json_response;

      if (!bookmark) return [
        null,
        json_response({ ok: true })
      ]

      bookmark._deleted = true;

      return [ bookmark, json_response({ ok: true }) ]
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

    if (type == "bookmark"){
      var required_fields = [
        'creation_date',
        'created_by',
        'subject'
      ]

      var allowed_keys = required_fields.slice(0, required_fields.length);
      allowed_keys.push('_deleted');

      var subject = new_doc.subject;

      var required_fields_for_subject = [
        'type',
        '_id'
      ]

      var allowed_subject_types = [
        'situation'
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

      // id: jeff.bookmarked.situation:1234asdg
      var id = [
        new_doc.created_by,
        'bookmarked',
        [ new_doc.subject.type, new_doc.subject._id ].join(':')
      ].join('.')

      required(
        new_doc._id == id,
        "'_id' must be '"+ id +"'"
      )

      restrict_keys(new_doc, allowed_keys);
    }
  },
  views: {
    by_subject: {
      map: function(doc){
        if (doc.type == 'bookmark'){
          emit([
            doc.subject._id,
            doc.creation_date
          ], 1);
        }
      },

      reduce: function(keys, values, rereduce){
        if (rereduce) return sum(values);
        return values.length;
      }
    }
  }
}
