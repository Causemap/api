module.exports.insert_or_update = function insert_or_update(
  db,
  new_doc,
  callback
){
  return db.insert(new_doc, function(insertion_error, insertion_result){
    if (insertion_error){
      if (insertion_error.error == 'conflict'){
        return db.get(new_doc._id, function(error, old_doc){
          if (error) return callback(error, null);
          new_doc._rev = old_doc._rev;

          return db.insert(new_doc, callback);
        })
      }

      return callback(insertion_error, null);
    }

    return callback(null, insertion_result);
  })
}


module.exports.operate = function(db, id, operation, callback){
  var that_function = this;
  var those_arguments = arguments;

  db.get(id, function(error_getting_doc, doc){
    if(error_getting_doc){
      return callback(error_getting_doc, null)
    }

    // enclose this in a `try` statement so that you can
    // throw an error inside your operation if you need to
    try{
      var updated_doc = operation(doc);
    } catch(update_error){
      return callback(update_error, null)
    }

    // your update operation needs to return the document
    // you want to insert
    if (updated_doc == undefined) return callback({
      error: "operation_error",
      reason: "operation returned undefined"
    })

    // here we try to insert the updated document
    db.insert(updated_doc, function(error, result){
      if(error){
        if(error.error == 'conflict'){

          // if there is a conflict error, call the
          // uppermost function again with the same
          // arguments
          return that_function.apply(those_arguments)
        }

        // if the error wasn't caused by a conflict,
        // return it in the callback
        return callback(error, null)
      }

      // if there was no error, your document has
      // been successfully updated
      return callback(null, result)
    })
  })
}
