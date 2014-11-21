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
      '_default_': require('./changes.default'),
      'situation.alias.change': require(
        './situation.alias.change'
      ),
      'situation.period.change': require(
        './situation.period.change'
      )
    }
  }
}
