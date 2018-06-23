/* Smart Cash API calls. */
const electron = require('electron')
const request = require('request')
const smartcash = require('smartcashjs-lib')
const rpc = require('./rpc-client')
const http = require('http')
const util = require('util')

const smartcashExplorer = "http://explorer3.smartcash.cc"

global.smartcashCallbackInfo = new Map() // keeps track of API callback vars per function call

//console.log(smartcash)


/* Check a SmartCash address for validity. */
function checkAddress(address) {
    //console.log('in checkAddress');
    //console.log('address: ', address);
    
    try {
        var result = smartcash.address.fromBase58Check(address)
        //console.log('result: ', result);
        return true
    }
    catch(err) {
        //console.log('err: ', err);
        return false
    }
}

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
    //console.log('PROJECT INFO: ', projectInfo)
    
    var txArray = []
    
    if (typeof projectInfo.txid === "string") {
        var obj = {}
        obj[projectInfo.txid] = false
        txArray.push(obj)
    }
    else {
        txArray = projectInfo.txid
    }
    
    var txid
    var cmd
    
    if (global.smartcashCallbackInfo.get(projectInfo.referrer) === undefined) {
        global.smartcashCallbackInfo.set(projectInfo.referrer, {
            apiCallbackCounter: 0,
            txCounter: 0,
            confirmedTxFlag: 0
        })
    }
    
    //console.log('txArray: ', txArray)
    
    txArray.forEach(function(tx, key) {
        //console.log('TX KEYS: ', Object.keys(tx)[0])
        
        confirmedTxFlag = 0
        txid = Object.keys(tx)[0]
        
        cmd = {
            method: 'getrawtransaction',
            params: [txid, 1]
        }
        
        //console.log('cmd: ', cmd)
        
        rpc.sendCmd(cmd, function(err, resp) {
            //console.log('checkTransaction')
            //console.log(err)
            //console.log(resp)
            //console.log('txid: ', cmd.params[0])
            //console.log('resp.confirmations: ', resp.confirmations)
            
            global.smartcashCallbackInfo.get(projectInfo.referrer).txCounter++
            //console.log('txCounter: ', global.smartcashCallbackInfo.get(projectInfo.referrer).txCounter);
            //console.log('txArray.length: ', txArray.length);

            if (err) {
                callback({type: 'error', msg: resp}, 'checkTransaction', projectInfo)
            }
            else {
                if (projectInfo.referrer !== "getWalletTxStatus") {                
                    if (projectInfo.referrer !== "getProjectTxStatus") {
                        if (resp.confirmations !== undefined)
                            callback({type: 'data', msg: resp}, 'checkTransaction', projectInfo)
                        else
                            callback({type: 'error', msg: 'Invalid transaction id.' + util.format(' (%s)', txid)}, 'checkTransaction', projectInfo)
                    }
                    else {
                        if (resp.confirmations !== undefined)
                            if (resp.confirmations >= 6) global.smartcashCallbackInfo.get(projectInfo.referrer).confirmedTxFlag++
                        else
                            callback({type: 'error', msg: 'Invalid transaction id.' + util.format(' (%s)', txid)}, 'checkTransaction', projectInfo)

                        if (global.smartcashCallbackInfo.get(projectInfo.referrer).txCounter == txArray.length)
                            callback({type: 'data', msg: global.smartcashCallbackInfo.get(projectInfo.referrer).confirmedTxFlag}, 'checkTransaction', projectInfo)
                    }
                }
                else {
                    // ignore the unknown transaction error for promotional wallet txids because it's probably not in the blockchain yet
                    if (resp.confirmations !== undefined)
                        callback({type: 'data', msg: resp}, 'checkTransaction', projectInfo)
                }
            }
        })
    })
}

/* Generate a random public/private key pair. */
function generateAddress() {
    var ecPair = smartcash.ECPair.makeRandom()
    var privateKey = ecPair.toWIF()
    var publicKey = ecPair.getAddress()

    return {privateKey: privateKey, publicKey: publicKey}
}

/* Get information for a given address. */
function getAddressInfo(projectInfo, callback) {
    request({
        url: smartcashExplorer + '/ext/getaddress/' + projectInfo.address,
        method: 'GET',
        json: true
    }, function (err, resp, body) {
        //console.log('checkBalance')
        //console.log(err)
        //console.log(resp.body)
        
        if (resp) {
            callback({type: 'data', msg: resp.body}, 'getAddressInfo', projectInfo)
        }
        else {
            console.log('getAddressInfo')
            console.log(err)
            
            if (err)
                callback({type: 'error', msg: err.code}, 'getAddressInfo', projectInfo)
        }
    })
}

/* Send funds from one address to another. */
function sendFunds(projectInfo, callback) {
    var receivers = projectInfo.toAddr
    
    request({
        url: smartcashExplorer + '/ext/getaddress/' + projectInfo.fromAddr,
        method: 'GET',
        json: true
    }, function (err, resp, body) {
        //console.log('sendFunds')
        //console.log(err)
        //console.log(resp.body)
        
        if (resp) {
            // check to see if there is enough in the balance to cover the amount to send
            if (parseFloat(resp.body.balance) >= projectInfo.total) {
                var txArray = []
                var newTx
                var transactions = []
                var outputs = {}
                
                resp.body.last_txs.forEach(function(tx, n) {
                    if (tx.type === "vout")
                        txArray.push(tx.addresses)
                })
                
                txArray.forEach(function(txid, txIndex) {
                    var getTxInfoCmd = {
                        method: 'getrawtransaction',
                        params: [txid, 1]
                    }
                    
                    rpc.sendCmd(getTxInfoCmd, function(err, resp) {
                        //console.log('sendFunds')
                        //console.log(err)
                        //console.log(resp)

                        if (err) {
                            callback({type: 'error', msg: "getrawtransaction failed."}, 'sendFunds', projectInfo)
                        }
                        else {                            
                            resp.vout.forEach(function(vout, voutIndex) {
                                if (vout.scriptPubKey.addresses.includes(projectInfo.fromAddr)) {
                                    transactions.push({
                                        'txid': txid,
                                        'vout': vout.n
                                    })
                                }
                            })

                            receivers.forEach(function(address, key) {
                                outputs[address] = projectInfo.amount
                            })
                            
                            var createTxCmd = {
                                method: 'createrawtransaction',
                                params: [transactions, outputs]
                            }
                            
                            rpc.sendCmd(createTxCmd, function(err, resp) {
                                if (err) {
                                    callback({type: 'error', msg: "createrawtransaction failed."}, 'sendFunds', projectInfo)
                                }
                                else {                                    
                                    var signTxCmd = {
                                        method: 'signrawtransaction',
                                        params: [resp, null, [projectInfo.fromPK]]
                                    }
                                    
                                    rpc.sendCmd(signTxCmd, function(err, resp) {
                                        if (err) {
                                            callback({type: 'error', msg: "signrawtransaction failed."}, 'sendFunds', projectInfo)
                                        }
                                        else if (resp.complete) {                                            
                                            var sendTxCmd = {
                                                method: 'sendrawtransaction',
                                                params: [resp.hex]
                                            }
                                            
                                            rpc.sendCmd(sendTxCmd, function(err, resp) {
                                                console.log(err)
                                                console.log(resp)
                                                
                                                if (err) {
                                                    callback({type: 'error', msg: "sendrawtransaction failed."}, 'sendFunds', projectInfo)
                                                }
                                                else {
                                                    callback({type: 'data', msg: resp}, 'sendFunds', projectInfo)
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })
                })
            }
            else {
                callback({type: 'error', msg: "Insufficient funds."}, 'sendFunds', projectInfo)
            }
        }
        else {
            callback({type: 'error', msg: err}, 'sendFunds', projectInfo)
        }
    })
}

/* Sweep (send) funds back from a promotional wallet address. */
function sweepFunds(projectInfo, callback) {
    //var receiver = addresses.receiver
    //var sender = addresses.sender
    
    // claimed = true
    // swept = true
    
    // add all non-claimed addresses to an array to use as inputs into transaction
}

module.exports = {
    checkAddress: checkAddress,
    checkBalance: checkBalance,
    checkTransaction: checkTransaction,
    generateAddress: generateAddress,
    getAddressInfo: getAddressInfo,
    sendFunds: sendFunds,
    sweepFunds: sweepFunds
};