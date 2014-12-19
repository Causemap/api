module.exports = {
  properties: {
    alias: {
      type: "string",
      fields: {
        untouched: {
          type: "string",
          index: "not_analyzed"
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
    description: {
      type: "string"
    },
    display_image: {
      properties: {
        caption: {
          type: "string"
        },
        change_id: {
          type: "string",
          index: "not_analyzed"
        },
        filename: {
          type: "string",
          index: "not_analyzed"
        },
        height: {
          type: "long"
        },
        width: {
          type: "long"
        }
      }
    },
    location: {
      type: "string"
    },
    marked_for_deletion: {
      type: "long"
    },
    name: {
      type: "string"
    },
    period: {
      properties: {
        began: {
          type: "long"
        },
        ended: {
          type: "long"
        },
        period: {
          type: "string"
        },
        tag_suggest: {
          properties: {
            input: {
              type: "string"
            }
          }
        },
        tagged: {
          type: "string"
        },
        text: {
          type: "string"
        },
        total_bookmarks: {
          type: "long"
        },
        total_causes: {
          type: "long"
        },
        total_effects: {
          type: "long"
        }
      }
    },
    tag_suggest: {
      type: "completion",
      analyzer: "simple",
      payloads: false,
      preserve_separators: true,
      preserve_position_increments: true,
      max_input_length: 50
    },
    tagged: {
      type: "string"
    },
    tags: {
      type: "string"
    },
    total_bookmarks: {
      type: "long"
    },
    total_causes: {
      type: "long"
    },
    total_changes: {
      type: "long"
    },
    total_effects: {
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
