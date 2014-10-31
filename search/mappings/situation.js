module.exports = {
  "properties": {
    "_id": {
      "type": "string",
      "index": "not_analyzed"
    },
    "created_by": {
      "type": "string",
      "index": "not_analyzed"
    },
    "alias": {
      "type": "multi_field",
      "fields": {
        "alias": {
          "type": "string",
          "index": "analyzed"
        },
        "untouched": {
          "type": "string",
          "index": "not_analyzed"
        }
      }
    },
    "display_image": {
      "properties": {
        "change_id": {
          "type": "string",
          "index": "not_analyzed"
        },
        "filename": {
          "type": "string",
          "index": "not_analyzed"
        },
      }
    },
    "type": {
      "type": "string",
      "index": "not_analyzed"
    }
  }
}
