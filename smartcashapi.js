/* Smart Cash API calls. */
const electron = require('electron')
const smartcash = require('smartcashjs-lib')
const testnet = smartcash.networks.testnet
const http = require('http')
//const https = require('https')
const util = require('util')

//console.log(smartcash)

/* Check the balance for a given address. */
function checkBalance(projectInfo, callback) {
    http.get({
        host: 'explorer3.smartcash.cc',
        path: '/ext/getaddress/' + projectInfo.address
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
                    callback({type: 'data', msg: parseFloat(parsedData.balance)}, projectInfo)
                else
                    callback({type: 'error', msg: parsedData.error + util.format(' (%s)', parsedData.hash)}, projectInfo)
            }
            catch (e) {
                console.log(e)
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
function generateAddress() {
    let ecPair = smartcash.ECPair.makeRandom({network: testnet})
    let privateKey = ecPair.toWIF()
    let publicKey = ecPair.getAddress()

    return {privateKey: privateKey, publicKey: publicKey}
}

/* Send funds from the from one address to another. */
function sendFunds(addresses) {
    let receiver = addresses.receiver
    let sender = addresses.sender
    
    var tx = new smartcash.TransactionBuilder(testnet)
   
    // get address info and get all unspent outputs for each txhash associated with sender address
    tx.addInput(txHash, vout)
    
    tx.addOutput(addrout, amttosend)
    tx.addOutput(sender, remainder) // the "change"
    
    // broadcast to network
}

/* Sweep (send) funds back from a promotional wallet address. */
function sweepFunds(addresses) {
    let receiver = addresses.receiver
    let sender = addresses.sender
    
    
}

module.exports = {
    checkBalance: checkBalance,
    checkTransaction: checkTransaction,
    generateAddress: generateAddress,
    sendFunds: sendFunds,
    sweepFunds: sweepFunds
};