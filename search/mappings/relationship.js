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

module.exports = {
  properties: {
    cause: situation_mapping,
    created_by: {
      type: "string",
      index: "not_analyzed"
    },
    creation_date: {
      type: "long"
    },
    description: {
      type: "string"
    },
    effect: situation_mapping,
    marked_for_deletion: {
      type: "long"
    },
    strength: {
      type: "long"
    },
    total_changes: {
      type: "long"
    },
    type: {
      type: "string",
      index: "not_analyzed"
    },
    unmarked_for_deletion: {
      type: "long"
    }
  }
}
