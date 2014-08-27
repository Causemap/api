module.exports = {
  "properties": {
    "cause": {
      "properties": {
        "_id": {
          "type": "string",
          "index": "not_analyzed"
       },
        "creation_date": {
          "type": "long"
        },
        "description": {
          "type": "string"
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
            "height": {
              "type": "long"
            },
            "width": {
              "type": "long"
            }
          }
        },
        "location": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "period": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "index": "not_analyzed"
        }
      }
    },
    "creation_date": {
      "type": "long"
    },
    "effect": {
      "properties": {
        "_id": {
          "type": "string",
          "index": "not_analyzed"
        },
        "creation_date": {
          "type": "long"
        },
        "description": {
          "type": "string"
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
            "height": {
              "type": "long"
            },
            "width": {
              "type": "long"
            }
          }
        },
        "location": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "period": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "index": "not_analyzed"
        }
      }
    },
    "type": {
      "type": "string",
      "index": "not_analyzed"
    }
  }
}
