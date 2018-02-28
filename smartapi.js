/* Smart Cash API calls. */

const smartcash = require('smartcashjs-lib')

module.exports = {
    generateAddress: function() {
        var ecPair = smartcash.ECPair.makeRandom()
        var privateKey = ecPair.toWIF()
        var publicKey = ecPair.getAddress()
        
        return {privateKey: privateKey, publicKey: publicKey}
    }
};