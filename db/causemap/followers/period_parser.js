var _ = require('lodash');
var request = require('request');
var moment = require('moment');
var async = require('async');
var follow = require('follow');
var feed = new follow.Feed({});
var elasticsearch = require('elasticsearch');
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

  if (change.changed.field.name != 'period') return;
  if (typeof change.changed.field.to == 'object') return;

  var period_text = change.changed.field.to;

  request.post({
    url: 'http://api.causemap.org:1337/',
    method: 'POST',
    json: true,
    body: {
      period: period_text
    }
  }, function(error, response, body){
    if (error) return console.error(error);
    var parsed_period = body;
    var began;
    var ended;

    if (parsed_period.length){
      var datetime = parsed_period[parsed_period.length -1];

      var ongoing_indication_strings = [
        'since',
        'now',
        'present',
        'today',
        'current'
      ];
      var is_ongoing;

      ongoing_indication_strings.forEach(function(word){
        if (period_text.toLowerCase().indexOf(word) != -1) is_ongoing = true;
      })

      if (datetime.value.type == 'interval'){
        if (!began) began = datetime.value.from.value;
        else began = datetime.value.from.value < began ? datetime.value.from.value : began;

        if (!is_ongoing){
          if (!ended) ended = datetime.value.to.value;
          else ended = datetime.value.to.value > ended ? datetime.value.to.value : ended;
        }
      } else {
        if (!began) began = datetime.value.value;
        else began = datetime.value.value < began ? datetime.value.value : began;

        var datetime_ended = (moment(datetime.value.value).add(
          1,
          datetime.value.grain +'s'
        )._d).toJSON();

        if (!is_ongoing){
          if (!ended) ended = datetime_ended;
          else ended = datetime_ended > ended ? datetime_ended : ended
        }
      }
    }

    var new_value = {
      text: period_text
    }

    if (began) new_value.began = (new Date(began)).getTime();
    else feed.emit('couldnt_parse', change, new_value);

    if(ended){
      new_value.ended = (new Date(ended)).getTime();

      if (new_value.ended > (new Date()).getTime()){
        new_value.ended = (new Date()).getTime();
      }
    }

    // update the change
    nano.use('causemap').atomic(
      'change',
      'parse_period',
      change._id,
      {
        field_name: 'period',
        field_value: new_value
      },
      function(error, response){
        if (error) return feed.emit('error', error);
        feed.emit('period_parsed', change, new_value);
      }
    )
  })
})



module.exports = feed;
