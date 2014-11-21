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
              "properties": {
                "began": {
                  "type": "long"
                },
                "ended": {
                  "type": "long"
                },
                "text": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  }
}
