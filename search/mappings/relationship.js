var situation_mapping = require('./situation');

module.exports = {
  "properties": {
    "cause": situation_mapping,
    "creation_date": {
      "type": "long"
    },
    "effect": situation_mapping,
    "created_by": {
      "type": "string",
      "index": "not_analyzed"
    },
    "type": {
      "type": "string",
      "index": "not_analyzed"
    }
  }
}
