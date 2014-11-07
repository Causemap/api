var toJSON = JSON.stringify;
var isArray = function(obj){ return obj instanceof Array }

var pop_request = function(user, request_to_pop){
  if (user.hasOwnProperty('requests')){
    user.requests = user.requests.filter(function(request){
      return request._id != request_to_pop._id;
    })
  }

  return user;
}


module.exports = {
  _id: '_design/user',
  dbname: '_users',
  language: 'javascript',
  shows: {
    has_bookmark: function(user_doc, req){
      return {
        body: toJSON({
          has_bookmark: user_doc.bookmarks.hasOwnProperty(req.query.id),
          type: user_doc.bookmarks[req.query.id] ? user_doc.bookmarks[req.query.id].type : undefined,
          id: req.query.id
        }),
        headers: {
          "Content-Type": "application/json"
        }
      }
    }
  },
  updates: {
    bookmark: function(user_doc, req){
      var body = JSON.parse(req.body);

      if (!user_doc.bookmarks){
        user_doc.bookmarks = {};
      }

      if (user_doc.bookmarks.hasOwnProperty(body.id)){
        return [user_doc, 'true']
      }

      user_doc.bookmarks[body.id] = {
        type: body.type,
        creation_date: (new Date()).getTime()
      }

      return [user_doc, 'true']
    },
    unbookmark: function(user_doc, req){
      var body = JSON.parse(req.body);

      if (!user_doc.bookmarks || !user_doc.bookmarks.hasOwnProperty(body.id)){
        return [user_doc, 'true'];
      }

      delete user_doc.bookmarks[body.id];

      return [user_doc, 'true']
    }
  },
  validate_doc_update: function (new_doc, old_doc, user_context){
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

    function allowed_keys(obj, keys){
      var fields = keys;
      fields.push('_id', '_rev', 'type', '_revisions');

      var obj_keys = Object.keys(obj);

      for (i in obj_keys){
        if (fields.indexOf(obj_keys[i]) == -1){
          throw({ forbidden: '"'+ obj_keys[i] +'" is not allowed.' })
        }
      }
    }

    if (new_doc.type == 'user'){

      required(
        new_doc.name.length < 25,
        "Your username must not exceed 24 characters"
      )

      if (new_doc.bookmarks){
        required(
          typeof new_doc.bookmarks == 'object' && new_doc.bookmarks != null,
          "'bookmarks' must be an object"
        )

        Object.keys(new_doc.bookmarks).forEach(function(bookmark_id){
          required(
            typeof bookmark_id == 'string',
            "bookmark ids must be strings: "+ bookmark_id
          )

          var bookmark = new_doc.bookmarks[bookmark_id];

          required(
            bookmark.hasOwnProperty('type'),
            "'bookmark.type' is required"
          )

          required(
            bookmark.hasOwnProperty('creation_date'),
            "'bookmark.creation_date' is required"
          )

          required(
            typeof bookmark.creation_date == 'number',
            "'bookmark.creation_date' must be a number"
          )

          required(
            ['situation'].indexOf(bookmark.type) != -1,
            "'bookmark.type' unsupported"
          )
        })
      }

      if (!user_is('_admin')){
        allowed_keys(new_doc, [
          'bookmarks',
          'derived_key',
          'iterations',
          'name',
          'password_scheme',
          'roles',
          'salt',
          'type',
          '_id',
          '_rev'
        ]);
      }
    }
  },
  views: {
    by_bookmarked: {
      map: function(user){
        if (!user.bookmarks){ return }
        Object.keys(user.bookmarks).forEach(function(bookmarked_id){
          emit([
            bookmarked_id,
            user.bookmarks[bookmarked_id].creation_date
          ], 1)
        })
      },
      reduce: function(keys, values, rereduce){
        if (rereduce){ return sum(values) }
        return sum(values);
      }
    }
  }
}
