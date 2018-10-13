const fs = require('fs')
const util = require('util')
const DEBUG = false

// saves debug info to a file
function debugSave(msg) {
    var expandedMsg = util.inspect(msg, {showHidden: true, depth: null})
    
    fs.appendFile('debug.txt', expandedMsg + "\n", (err) => {
      if (err) console.log(err)
    })
}

module.exports = {
    DEBUG: DEBUG,
    debugSave: debugSave
}