var designs = require('./designs');
module.exports = Object.keys(designs).map(function(design_key){
  return designs[design_key]
});
