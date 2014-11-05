


var toJSON = JSON.stringify;


module.exports = {
  _id: '_design/adjustment',
  language: 'javascript',
  shows: {
    adjustment: function(doc, req){
      return toJSON({
        ok: !!doc,
        doc: doc
      })
    }
  },
  updates: {
    upvote_relationship: function(doc, req){
      if (doc){
        doc.adjusted.field.by = +1;
        return [doc, 'saved']
      }

      var id = (
        req.id && req.id.split(':').splice(
          1, req.id.split(':').length
        ).join(':')
      ) || '';

      var new_adjustment = {
        _id: req.id,
        type: 'adjustment',
        adjusted: {
          doc: {
            type: 'relationship',
            _id: id
          },
          field: {
            name: 'strength',
            by: 1
          }
        },
        created_by: req.userCtx.name,
        creation_date: (new Date()).getTime()
      }

      return [new_adjustment, 'saved']
    },
    downvote_relationship: function(doc, req){
      if (doc){
        doc.adjusted.field.by = -1;
        return [doc, 'saved']
      }

      var id = (
        req.id && req.id.split(':').splice(
          1, req.id.split(':').length
        ).join(':')
      ) || '';

      var new_adjustment = {
        _id: req.id,
        type: 'adjustment',
        adjusted: {
          doc: {
            type: 'relationship',
            _id: id
          },
          field: {
            name: 'strength',
            by: -1
          }
        },
        created_by: req.userCtx.name,
        creation_date: (new Date()).getTime()
      }

      return [new_adjustment, 'saved']
    },
    unvote_relationship: function(doc, req){
      if (doc){
        doc.adjusted.field.by = 0;
        return [doc, 'saved']
      }

      var id = (
        req.id && req.id.split(':').splice(
          1, req.id.split(':').length
        ).join(':')
      ) || '';

      var new_adjustment = {
        _id: req.id,
        type: 'adjustment',
        adjusted: {
          doc: {
            type: 'relationship',
            _id: id
          },
          field: {
            name: 'strength',
            by: 0
          }
        },
        created_by: req.userCtx.name,
        creation_date: (new Date()).getTime()
      }

      return [new_adjustment, 'saved']
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

    if (new_doc.type == 'adjustment'){
      var required_fields = [
        'adjusted',
        'created_by',
        'creation_date',
      ]

      var allowed_fields = required_fields;

      required_fields.forEach(function(field_name){
        required(
          new_doc.hasOwnProperty(field_name),
          "'"+ field_name +"' is required."
        )
      })

      restrict_keys(new_doc, allowed_fields);

      var adjusted = new_doc.adjusted;

      required(
        typeof adjusted == 'object' && adjusted != null,
        "'adjusted' must be an object"
      )

      var required_fields_for_adjusted = [
        'doc',
        'field'
      ]

      required_fields_for_adjusted.forEach(function(field_name){
        required(
          adjusted.hasOwnProperty(field_name),
          "'adjusted."+ field_name +"' is required."
        )

        required(
          typeof adjusted[field_name] == 'object' && adjusted[field_name] != null,
          "'adjusted."+ field_name +"' must be an object"
        )
      })

      restrict_keys(adjusted, required_fields_for_adjusted);

      var required_fields_for_adjusted_doc = [
        '_id',
        'type'
      ]

      required_fields_for_adjusted_doc.forEach(function(field_name){
        required(
          adjusted.doc.hasOwnProperty(field_name),
          "'adjusted.doc."+ field_name +"' is required."
        )
      })

      restrict_keys(adjusted.doc, required_fields_for_adjusted_doc);

      required(
        typeof adjusted.doc._id == 'string',
        "'adjusted.doc._id' must be a string"
      )

      required(
        ['relationship'].indexOf(adjusted.doc.type) != -1,
        "'adjusted.doc.type' unsupported"
      )

      var required_fields_for_adjusted_field = [
        'name',
        'by'
      ]

      required_fields_for_adjusted_field.forEach(function(field_name){
        required(
          adjusted.field.hasOwnProperty(field_name),
          "'adjusted.field."+ field_name +"' is required"
        )
      })

      var adjustable_field_names = [
        'strength'
      ]

      required(
        adjustable_field_names.indexOf(adjusted.field.name) != -1,
        "'adjusted.field.name' not supported"
      )

      required(
        typeof adjusted.field.by == 'number',
        "'adjusted.field.by' must be a number"
      )

      if (adjusted.field.name == 'strength'){
        var possible_values = [
          1,
          -1,
          0
        ]

        required(
          possible_values.indexOf(adjusted.field.by) != -1,
          "'adjusted.field.by' must be one of "+ possible_values.join(', ')
        )

        var id = [
          user_context.name,
          '.adjusted.relationship.strength:',
          new_doc.adjusted.doc._id
        ].join('')

        // 'jeff.adjusted.relationship.strength:1234'
        required(
          new_doc._id == id,
          "'_id' must be "+ id
        )
      }
    }
  },

  views: {
    by_adjusted_field: {
      map: function(doc){
        if (doc.type == 'adjustment'){
          emit([
            doc.adjusted.doc._id,
            doc.adjusted.field.name,
            doc.creation_date
          ], doc.adjusted.field.by);
        }
      },
      reduce: function(keys, values, rereduce){
        if (rereduce){ return sum(values) }
        return sum(values);
      }
    },

    by_creator: {
      map: function(doc){
        if (doc.type == 'adjustment'){
          emit([
            doc.created_by
          ], null)
        }
      }
    }
  }
}
