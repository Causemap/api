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
              type: "string"
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
