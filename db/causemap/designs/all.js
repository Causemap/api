


var toJSON = JSON.stringify;


module.exports = {
  _id: '_design/all',
  language: 'javascript',
  filters: {
    design_docs: function(doc, req){
      if (doc._id.match(/^_design/)) return true;
      return false;
    }
  },
  validate_doc_update: function(new_doc, old_doc, user_context){

    if (new_doc._deleted){
      return
    }

    function user_is(role){
      return user_context.roles.indexOf(role) >= 0;
    }

    function required(be_true, message){
      if (!be_true) throw { forbidden: message };
    }

    function unchanged(field) {
      if (old_doc && toJSON(old_doc[field]) != toJSON(new_doc[field]))
        throw({ forbidden : "Field can't be changed: " + field });
    }

    required(
      new_doc.hasOwnProperty('type'),
      "'type' is required."
    )

    required(
      [
        'situation',
        'relationship',
        'action',
        'change'
      ].indexOf(new_doc.type) != -1,
      "Unsupported doc.type"
    )

    unchanged('type');
    unchanged('creation_date');

    if(new_doc.hasOwnProperty('creation_date')){
      required(
        typeof new_doc.creation_date == 'number',
        "'creation_date' must be a number.");
    }

    if (new_doc.hasOwnProperty('created_by')){
      unchanged('created_by');

      required(
        user_context.hasOwnProperty('name') && user_context.name != null,
        "You must be logged in to continue."
      )

      if (!user_is('_admin')){
        required(
          new_doc.created_by == user_context.name,
          "'created_by' must be your username"
        )
      }
    }
  }
}

