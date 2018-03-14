/* Smart Cash API calls. */
const electron = require('electron')
const smartcash = require('smartcashjs-lib')
const http = require('http')

//console.log(smartcash)

/* Check the balance for a given address. */
function checkBalance(address, addrAmt, callback) {
    http.get({
        host: 'explorer3.smartcash.cc',
        path: '/ext/getbalance/' + address
    }, (resp) => {
        //const {statusCode} = resp
        let rawData = ""
        
        resp.on('data', (chunk) => { rawData += chunk })  
        resp.on('end', () => {
                try {
                    callback({type: 'data', msg: rawData}, addrAmt)
                }
                catch (e) {
                   callback({type: 'error', msg: e.message})
                }
        })
        .on('error', (e) => {
            callback({type: 'error', msg: e.message})
        })
    })
}

/* Check the status of a transaction. */
function checkTransaction(txid) {
    http.get({
        host: 'explorer3.smartcash.cc',
        path: '/ext/getrawtransaction/' + txid
    }, (resp) => {
        //const {statusCode} = resp
        let rawData = ""
        
        resp.on('data', (chunk) => { rawData += chunk })  
        resp.on('end', () => {
                try {
                    const parsedData = JSON.parse(rawData)
                    callback({type: 'data', msg: parsedData}, addrAmt)
                }
                catch (e) {
                   callback({type: 'error', msg: e.message})
                }
        })
        .on('error', (e) => {
            callback({type: 'error', msg: e.message})
        })
    })
}

/* Generate a random public/private key pair. */
function generateAddresses() {
    let ecPair = smartcash.ECPair.makeRandom()
    let privateKey = ecPair.toWIF()
    let publicKey = ecPair.getAddress()

    return {privateKey: privateKey, publicKey: publicKey}
}

/* Send funds from the project address to a wallet address. */
function sendFunds(addresses) {
    let receiver = addresses.receiver
    let sender = addresses.sender
    
}

/* Sweep (send) funds back from a wallet address to a project address. */
function sweepFunds(addresses) {
    let receiver = addresses.receiver
    let sender = addresses.sender
    
    
}

module.exports = {
    checkBalance: checkBalance,
    checkTransaction: checkTransaction,
    generateAddresses: generateAddresses,
    sendFunds: sendFunds,
    sweepFunds: sweepFunds
};