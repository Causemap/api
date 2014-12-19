module.exports = {
  properties: {
    changed: {
      properties: {
        doc: {
          properties: {
            _id: {
              type: "string"
            },
            type: {
              type: "string"
            }
          }
        },
        field: {
          properties: {
            name: {
              type: "string"
            },
            to: {
              properties: {
                caption: {
                  type: "string"
                },
                change_id: {
                  type: "string"
                },
                filename: {
                  type: "string"
                },
                height: {
                  type: "long"
                },
                width: {
                  type: "long"
                }
              }
            }
          }
        }
      }
    },
    created_by: {
      type: "string",
      index: "not_analyzed"
    },
    creation_date: {
      type: "long"
    },
    type: {
      type: "string"
    }
  }
}
