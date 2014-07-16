


var toJSON = JSON.stringify;


module.exports = {
  _id: '_design/immutable',
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

    if (new_doc.hasOwnProperty('immutable')){
      required(
        new_doc.immutable === true,
        "'immutable' may only be set to 'true'.");

      if (!user_is('_admin')){
        required(
          !old_doc || new_doc._deleted,
          "Immutable docs cannot be updated."
        )
      }
    }
  }
}
