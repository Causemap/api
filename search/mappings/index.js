module.exports = {
  relationships: {
    mappings: {
      relationship: require('./relationship')
    }
  },
  situations: {
    mappings: {
      situation: require('./situation')
    }
  },
  changes: {
    mappings: {
      'situation.alias.change': require(
        './situation.alias.change'
      )
    }
  }
}
