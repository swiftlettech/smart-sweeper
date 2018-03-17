/* Smart Cash API calls. */
const electron = require('electron')
const smartcash = require('smartcashjs-lib')
const http = require('http')
const util = require('util')

//console.log(smartcash)

/* Check the balance for a given address. */
function checkBalance(address, addrAmt, callback) {
    http.get({
        host: 'explorer3.smartcash.cc',
        path: '/ext/getaddress/' + address
    }, (resp) => {
        const {statusCode} = resp
        
        if (statusCode !== 200) {
            let error = new Error('Request Failed. Status Code: ' + statusCode);
            callback({type: 'error', msg: error.message})
            return
        }
        
        let rawData = ""
        
        resp.on('data', (chunk) => { rawData += chunk })  
        resp.on('end', () => {            
            try {
                const parsedData = JSON.parse(rawData)
                
                if (parsedData.balance !== undefined)
                    callback({type: 'data', msg: parseFloat(parsedData.balance)}, addrAmt)
                else
                    callback({type: 'error', msg: parsedData.error + util.format(' (%s)', parsedData.hash)})
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
function checkTransaction(txid, addrAmt, callback) {
    http.get({
        host: 'explorer3.smartcash.cc',
        path: '/api/getrawtransaction?txid=' + txid + '&decrypt=1'
    }, (resp) => {
        const {statusCode} = resp
        
        if (statusCode !== 200) {
            let error = new Error('Request Failed. Status Code: ' + statusCode);
            callback({type: 'error', msg: error.message})
            return
        }
        
        let rawData = ""
        
        resp.on('data', (chunk) => { rawData += chunk })
        resp.on('end', () => {
            try {
                const parsedData = JSON.parse(rawData)

                if (parsedData.confirmations !== undefined)
                    callback({type: 'data', msg: parsedData.confirmations}, addrAmt)
                else
                    callback({type: 'error', msg: 'Invalid transaction id.' + util.format(' (%s)', txid)})
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