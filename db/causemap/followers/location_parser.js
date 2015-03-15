var request = require('request');
var follow = require('follow');
var feed = new follow.Feed({});
var nano;
var es_client;


feed.include_docs = true;

feed.on('start', function(){
  nano = require('nano')(feed.db_host);
});

feed.on('change', function(change){
  if (change.deleted) return;
  if (change.doc.type != 'change') return;

  var change = change.doc;

  if (change.changed.field.name != 'location') return;
  if (change.changed.field.to.hasOwnProperty('coords')) return;
  if (change.changed.field.to.hasOwnProperty('no_coords')) return;

  var location_text = typeof change.changed.field.to == 'string' ? change.changed.field.to : change.changed.field.to.text;

  request.post({
    url: [
      'https://maps.googleapis.com/maps/api/geocode/json?address=',
      encodeURIComponent(location_text),
      '&sensor=false&key=',
      feed.api_key
    ].join(''),
    method: 'GET',
    json: true
  }, function(error, response, body){
    if (error) return console.error(error);
    var parsed_location = body;

    var new_value = {
      text: location_text
    }

    if (parsed_location.results.length){
      var l = parsed_location.results[0];
      new_value.coords = {
        lat: l.geometry.location.lat,
        lon: l.geometry.location.lng
      }
    } else {
      new_value.no_coords = true;
    }

    // update the change
    nano.use(feed.db_name).atomic(
      'change',
      'parse_location',
      change._id,
      {
        field_name: 'period',
        field_value: new_value
      },
      function(error, response){
        if (error) return feed.emit('error', error);
        feed.emit('location_parsed', change, new_value);
      }
    )
  })
})



module.exports = feed;
