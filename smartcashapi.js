/* Smart Cash API calls. */
const electron = require('electron')
const winston = require('winston')
const request = require('request')
const smartcash = require('smartcashjs-lib')
const smartcashExplorer = "http://explorer3.smartcash.cc"
const rpcapi = require('./rpc-explorer/app/rpcApi')
const rpcenv = require("./rpc-explorer/app/env")
//const testnet = smartcash.networks.testnet
const http = require('http')
const util = require('util')

//console.log(smartcash)

let logger = winston.loggers.get('logger')
let callbackCounter = 0

/* Check the balance for a given address. */
function checkBalance(projectInfo, callback) {
    request({
        url: smartcashExplorer + '/ext/getaddress/' + projectInfo.address,
        method: 'GET',
        json: true
    }, function (err, resp, body) {
        if (resp) {
            var balance
            
            if (resp.body.balance !== undefined)
                balance = resp.body.balance
            else
                balance = 0
            
            callback({type: 'data', msg: balance}, 'checkBalance', projectInfo)
        }
        else {
            console.log(err)
            
            if (err)
                callback({type: 'error', msg: err.code}, 'checkBalance', projectInfo)
        }
    })
}

/* Check the status of a transaction. */
function checkTransaction(projectInfo, callback) {
    //console.log(rpcapi.getRawTransaction(projectInfo.txid))
    rpcapi.getRawTransactions('4254cfa40a527a178bd353f935aed6a573bc00a1a3eef557bfa90d8b9c4ec872,f4eeeac4ec3a3e5e17b64b09afb79e9f3f614afa8303c40217c0835e4e34671a').then(function(resp) {
        console.log(resp)
    })
    //4254cfa40a527a178bd353f935aed6a573bc00a1a3eef557bfa90d8b9c4ec872
    //f4eeeac4ec3a3e5e17b64b09afb79e9f3f614afa8303c40217c0835e4e34671a
    
    /*http.get({
        host: 'explorer3.smartcash.cc',
        path: '/api/getrawtransaction?txid=' + txid + '&decrypt=1'
    }, (resp) => {
        var returnedData
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

                if (parsedData.confirmations !== undefined) {
                    returnedData = callback({type: 'data', msg: parsedData.confirmations}, projectInfo.addrAmt)
                    return returnedData
                }
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
    })*/
}

/* Start the RPC explorer. */
function connRpcExplorer(callback) {
    request({
        url: 'http://localhost/connect',
        method: 'POST',
        json: true,
        body: {
            host: rpcenv.smartcashd.host,
            port: rpcenv.smartcashd.port,
            username: rpcenv.smartcashd.rpc.username,
            password: rpcenv.smartcashd.rpc.password
        }
    }, function (err, resp, body) {
        if (resp && resp.body.success) {
            callback({type: 'data', msg: resp.body.msg}, 'connRpcExplorer')
        }
        else if (err) {
            callback({type: 'error', msg: err.code}, 'connRpcExplorer')
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

/* Disconnect from the RPC explorer. */
function disconnRpcExplorer() {
    request({
        url: 'http://localhost/disconnect',
        method: 'POST',
        body: ''
    }, function (err, resp, body) {})
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
    connRpcExplorer: connRpcExplorer,
    coreSync: coreSync,
    disconnRpcExplorer: disconnRpcExplorer,
    generateAddress: generateAddress,
    getBlockCount: getBlockCount,
    sendFunds: sendFunds,
    sweepFunds: sweepFunds
};