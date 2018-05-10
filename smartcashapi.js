/* Smart Cash API calls. */
//const electron = require('electron')
const request = require('request')
const smartcash = require('smartcashjs-lib')
const smartcashExplorer = "http://explorer3.smartcash.cc"
const rpc = require('./rpc-client')
//const testnet = smartcash.networks.testnet
const http = require('http')
const util = require('util')

//console.log(smartcash)

let callbackCounter = 0

/* Check the balance for a given address. */
function checkBalance(projectInfo, callback) {
    request({
        url: smartcashExplorer + '/ext/getaddress/' + projectInfo.address,
        method: 'GET',
        json: true
    }, function (err, resp, body) {
        //console.log('checkBalance')
        //console.log(err)
        //console.log(resp.body)
        
        if (resp) {
            var balance
            
            if (resp.body.balance !== undefined)
                balance = resp.body.balance
            else
                balance = 0
            
            callback({type: 'data', msg: balance}, 'checkBalance', projectInfo)
        }
        else {
            console.log('checkBalance')
            console.log(err)
            
            if (err)
                callback({type: 'error', msg: err.code}, 'checkBalance', projectInfo)
        }
    })
}

/* Check the status of a transaction. */
function checkTransaction(projectInfo, callback) {
    var cmd = {
        method: 'getrawtransaction',
        params: [projectInfo.txid, 1]
    }
    
    //projectInfo.addrBatch
    
    rpc.sendCmd(cmd, function(err, resp) {
        //console.log('checkTransaction')
        //console.log(err)
        //console.log(resp)
        
        if (err) {
            callback({type: 'error', msg: resp}, 'checkTransaction', projectInfo)
        }
        else {
            if (resp.confirmations !== undefined)
                callback({type: 'data', msg: resp}, 'checkTransaction', projectInfo)
            else
                callback({type: 'error', msg: 'Invalid transaction id.' + util.format(' (%s)', txid)}, 'checkTransaction', projectInfo)
        }
    })
}

/* Generate a random public/private key pair. */
function generateAddress() {
    var ecPair = smartcash.ECPair.makeRandom()
    var privateKey = ecPair.toWIF()
    var publicKey = ecPair.getAddress()

    return {privateKey: privateKey, publicKey: publicKey}
}

/* Send funds from one address to another. */
function sendFunds(projectInfo) {
    var callback = function(resp) {

        //var tx = new smartcash.TransactionBuilder()
        //tx.addInput(txHash, vout)

        // get address info and get all unspent outputs for each txhash associated with sender address
        /*tx.addInput(txHash, vout)
        tx.addOutput(publicKey, amttosend)
        tx.addOutput(sender, remainder) // the "change"
        tx.sign(vinIndex, keyPair)*/

        // check all previous transactions for the sender address and get the UTXOs

        //tx.addInput(txHash, vout)    
        //tx.addOutput(publicKey, amttosend)
        //tx.addOutput(sender, remainder) // the "change"
        //tx.sign(vinIndex, keyPair)

        // broadcast to network
        //console.log(tx)
    }
    
    request({
        url: smartcashExplorer + '/ext/getaddress/' + sender.publicKey,
        method: 'GET',
        json: true
    }, function (err, resp, body) {
        console.log('sendFunds')
        console.log(err)
        console.log(resp.body)
        
        if (resp) {
            var receiver = projectInfo.toAddr
            var sender = {publicKey: projectInfo.fromAddr, privateKey: projectInfo.fromPK}
        }
        else {
            remote.getGlobal('sharedObject').logger.error('sendFunds: ' + err)
        }
    })
}

/* Sweep (send) funds back from a promotional wallet address. */
function sweepFunds(addresses) {
    var receiver = addresses.receiver
    var sender = addresses.sender
    
    
}

module.exports = {
    checkBalance: checkBalance,
    checkTransaction: checkTransaction,
    generateAddress: generateAddress,
    sendFunds: sendFunds,
    sweepFunds: sweepFunds
};