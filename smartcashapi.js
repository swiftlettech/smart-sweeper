/* Smart Cash API calls. */
//const electron = require('electron')
//const winston = require('winston')
const request = require('request')
const smartcash = require('smartcashjs-lib')
const smartcashExplorer = "http://explorer3.smartcash.cc"
const rpcapi = require('./rpc-explorer/app/rpcApi')
const rpcenv = require("./rpc-explorer/app/env")
const rpcExplorer = 'http://' + rpcenv.smartcashd.host
const rpc = require('./rpc-client')
//const testnet = smartcash.networks.testnet
const http = require('http')
const util = require('util')

//console.log(smartcash)

//let logger = winston.loggers.get('logger')
let callbackCounter = 0

/* Check the balance for a given address. */
function checkBalance(projectInfo, callback) {
    request({
        url: smartcashExplorer + '/ext/getaddress/' + projectInfo.address,
        method: 'GET',
        json: true
    }, function (err, resp, body) {
        console.log('checkBalance')
        console.log(err)
        console.log(resp.body)
        
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
                callback({type: 'data', msg: resp.confirmations}, 'checkTransaction', projectInfo)
            else
                callback({type: 'error', msg: 'Invalid transaction id.' + util.format(' (%s)', txid)}, 'checkTransaction', projectInfo)
        }
    })
}

/* Syncs SmartCash core if behind. */
function coreSync(callback) {
    request({
        url: 'http://localhost/terminal',
        method: 'POST',
        json: true,
        body: {
            cmd: 'snsync next'
        }
    }, function (err, resp, body) {
        if (resp && resp.body.success) {
            callback({type: 'data', msg: resp.body.msg}, 'coreSync')
        }
        else if (err) {
            callback({type: 'error', msg: err.code}, 'coreSync')
        }
    })
}

/* Generate a random public/private key pair. */
function generateAddress() {
    let ecPair = smartcash.ECPair.makeRandom()
    let privateKey = ecPair.toWIF()
    let publicKey = ecPair.getAddress()

    return {privateKey: privateKey, publicKey: publicKey}
}

/* Get the current block count. */
function getBlockCount(online, callback) {
    var localHeaderCount
    var onlineBlockCount
    var localBlockCount
    var valid = 0
    var validFlag = false
    
    // check the local blockchain regardless of internet connection status
    request({
        url: 'http://localhost/terminal',
        method: 'POST',
        json: true,
        body: {
            cmd: 'getblockchaininfo'
        }
    }, function (err, resp, body) {
        if (resp && resp.body) {
            localHeaderCount = parseInt(resp.body.headers)
            localBlockCount =  parseInt(resp.body.blocks)
            
            if (localHeaderCount == localBlockCount)
                valid++
            
            if (online) {
                // there is an active internet connection, check the online block explorer
                request({
                    url: smartcashExplorer + '/api/getblockcount',
                    method: 'GET'
                }, function (err, resp, body) {
                    if (resp && resp.body) {
                        onlineBlockCount = parseInt(resp.body)

                        if (localHeaderCount == onlineBlockCount)
                            valid++

                        if (valid == 2)
                            validFlag = true
                        
                        console.log('validFlag')
                        console.log(validFlag)

                        callback({type: 'data', msg: validFlag}, 'getBlockCount')
                    }
                    else {
                        console.log('getBlockCount')
                        console.log(err)
                        
                        if (err)
                            callback({type: 'error', msg: err}, 'getBlockCount')
                    }
                })
            }
            else {
                if (valid == 1)
                    validFlag = true
                
                callback({type: 'data', msg: validFlag}, 'getBlockCount')
            }
        }
        else {
            console.log('getBlockCount')
            console.log(err)
            
            if (err)
                callback({type: 'error', msg: err.code}, 'getBlockCount')
        }
    })
}

/* Send funds from the from one address to another. */
function sendFunds(projectInfo) {
    let receiver = projectInfo.projectAddr
    let sender = {publicKey: projectInfo.sourceAddr, privateKey: projectInfo.sourcePK}
    
    var tx = new smartcash.TransactionBuilder()
   
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
    console.log('sendFunds')
    console.log(tx)
}

/* Sweep (send) funds back from a promotional wallet address. */
function sweepFunds(addresses) {
    let receiver = addresses.receiver
    let sender = addresses.sender
    
    
}

module.exports = {
    checkBalance: checkBalance,
    checkTransaction: checkTransaction,
    coreSync: coreSync,
    generateAddress: generateAddress,
    getBlockCount: getBlockCount,
    sendFunds: sendFunds,
    sweepFunds: sweepFunds
};