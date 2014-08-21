


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
  _id: '_design/change',
  language: 'javascript',
  util: {
    response: 'exports.json_response = '+ json_response.toString()
  },
  updates: {
    create: function(changed_doc, req){
      var json_response = require('util/response').json_response;
      var body = JSON.parse(req.body);

      var new_change = {
        _id: req.uuid,
        type: 'change',
        created_by: req.userCtx.name,
        creation_date: (new Date()).getTime(),
        immutable: true,
        changed: {
          doc: {
            _id: changed_doc._id,
            type: changed_doc.type
          },
          field: {
            name: body.field_name,
            to: body.field_value
          }
        }
      }

      return [new_change, json_response({
        ok: true,
        id: new_change._id
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

    if (type == "change"){
      var required_fields = [
        'immutable',
        'creation_date',
        'created_by',
        'changed'
      ]

      var allowed_keys = required_fields;
      var changed = new_doc.changed;

      var required_fields_for_changed = [
        'doc',
        'field'
      ]

      var required_fields_for_changed_doc = [
        '_id',
        'type'
      ]

      var changeable_doc_types = [
        'situation',
        'relationship'
      ]

      var required_fields_for_changed_field = [
        'name',
        'to'
      ]

      required_fields.forEach(function(required_field){
        required(
          new_doc.hasOwnProperty(required_field),
          "'"+ required_field +"' is required"
        )
      })

      required(
        typeof changed == 'object' && changed != null,
        "'changed' must be an object"
      )

      required_fields_for_changed.forEach(function(required_field_for_changed){
        required(
          changed.hasOwnProperty(required_field_for_changed),
          "'changed."+ required_field_for_changed +"' is required"
        )
      })

      required(
        typeof changed.doc == 'object' && changed.doc != null,
        "'changed.doc' must be an object"
      )

      required_fields_for_changed_doc.forEach(function(field_name){
        required(
          changed.doc.hasOwnProperty(field_name),
          "'changed.doc."+ field_name +"' is required"
        )
      })

      required(
        typeof changed.doc._id == 'string',
        "'changed.doc._id' must be a string.");

      required(
        changeable_doc_types.indexOf(changed.doc.type) != -1,
        "'changed.doc.type' is not supported");

      required_fields_for_changed_field.forEach(function(field_name){
        required(
          changed.field.hasOwnProperty(field_name),
          "'changed.field."+ field_name +"' is required"
        )
      })


      var field_name = changed.field.name;
      var value = changed.field.to;

      // if the change is made to a situation
      if (changed.doc.type == 'situation'){
        var changeable_field_names = [
          'name',
          'period',
          'location',
          'alias',
          'description'
        ]

        required(
          changeable_field_names.indexOf(field_name) != -1,
          "'changed.field.name' is not supported for type"
        )

        if (field_name == 'name'){
          required(
            typeof value == 'string',
            "A situation's name must be a string.");

          required(
            value.length <= 115,
            "A situation's name may be no more than 115 characters long.");
        }

        if (field_name == 'location'){
          required(
            typeof value == 'string',
            "A situation's location must be a string.");

          required(
            value.length <= 64,
            "A situation's location may be no more than 64 characters long.");
        }

        if (field_name == 'alias'){
          function isSlug(str){
            return str.match(/^[a-z0-9-]+$/) ? true : false
          }

          required(
            typeof value == 'string',
            "A situation's 'alias' must be a string.");

          required(
            isSlug(value),
            [
              "A situation's 'alias' may contain only",
              "lowercase letters, numbers, dashes and underscores."
            ].join(' '));
        }
      }

      if (changed.doc.type == 'relationship'){
        var changeable_field_names = [
          'description'
        ]

        required(
          changeable_field_names.indexOf(field_name) != -1,
          "'changed.field.name' is not supported for type"
        )

        if (field_name == 'description'){
          required(
            typeof value == 'string',
            "A relationship's 'description' must be a string."
          )
        }
      }

      restrict_keys(new_doc, allowed_keys);
    }
  },
  views: {
    field_summary: {
      map: function(doc){
        if (doc.type == 'change'){
          emit(doc._id, doc.changed.field);
        }
      }
    },
    by_changed: {
      map: function(doc){
        if (doc.type == 'change'){
          emit([
            doc.changed.doc._id,
            doc.changed.doc.type,
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
