module.exports = {
  "properties": {
    "_id": {
      "type": "string",
      "index": "not_analyzed"
    },
    "changed": {
      "properties": {
        "field": {
          "properties": {
            "to": {
              "type": "multi_field",
              "fields": {
                "to": {
                  "type": "string",
                  "index": "analyzed"
                },
                "untouched": {
                  "type": "string",
                  "index": "not_analyzed"
                }
              }
            }
          }
        }
      }
    }
  }
}
