module.exports.causemap = {
  mappings: {
    relationship: require('./relationship'),
    situation: require('./situation'),
    '_default_': require('./changes.default'),
    'relationship.description.change': require('./relationship.description.change'),
    'situation.alias.change': require('./situation.alias.change'),
    'situation.description.change': require('./situation.description.change'),
    'situation.period.change': require('./situation.period.change'),
    'situation.display_image.change': require('./situation.display_image.change'),
    'situation.location.change': require('./situation.location.change'),
    'situation.name.change': require('./situation.name.change')
  }
}
