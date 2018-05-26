/* Smart Cash API calls. */
//const electron = require('electron')
const request = require('request')
const smartcash = require('smartcashjs-lib')
const rpc = require('./rpc-client')
const http = require('http')
const util = require('util')

const smartcashExplorer = "http://explorer3.smartcash.cc"
const minTxFee = 0.001;

//console.log(smartcash)

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
    //console.log('PROJECT INFO TXID: ', projectInfo.txid)
    
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
    var txCounter = 0
    var cmd
    var response = []
    
    //console.log('txArray: ', txArray)
    
    txArray.forEach(function(tx, key) {
        //console.log('TX KEYS: ', Object.keys(tx)[0])
        
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
            console.log('resp.confirmations: ', resp.confirmations)
            
            txCounter++
            console.log('txCounter: ', txCounter);
            console.log('txArray.length: ', txArray.length);

            if (err) {
                callback({type: 'error', msg: resp}, 'checkTransaction', projectInfo)
            }
            else {
                if (resp.confirmations !== undefined)
                    callback({type: 'data', msg: response}, 'checkTransaction', projectInfo)
                else
                    callback({type: 'error', msg: 'Invalid transaction id.' + util.format(' (%s)', txid)}, 'checkTransaction', projectInfo)
                
                
                /*if (resp.confirmations === undefined)
                    callback({type: 'error', msg: 'Invalid transaction id.' + util.format(' (%s)', txid)}, 'checkTransaction', projectInfo)
                
                if (txCounter == txArray.length) {
                    //console.log('response: ', response);
                    
                    //if (resp.confirmations !== undefined)
                        //callback({type: 'data', msg: response}, 'checkTransaction', projectInfo)
                }
                else {
                    var obj = {}
                    obj[txid] = resp
                    response.push(obj)
                }
                
                console.log('response.length: ', response.length);*/
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
    //var callback = function(resp) {
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
    //}
    
    var sender = smartcash.ECPair.fromWIF(projectInfo.fromPK)
    var receiver = projectInfo.toAddr
    
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
            if (parseFloat(resp.body.balance) >= projectInfo.amount) {
                var txArray = []
                var newTx
                var cmd
                
                resp.body.last_txs.forEach(function(tx, n) {
                    if (tx.type === "vout")
                        txArray.push(tx.addresses)
                })
                
                txArray.forEach(function(txid, txIndex) {
                    cmd = {
                        method: 'getrawtransaction',
                        params: [txid, 1]
                    }
                    
                    rpc.sendCmd(cmd, function(err, resp) {
                        //console.log('sendFunds')
                        //console.log(err)
                        //console.log(resp)

                        if (err) {
                            callback({type: 'error', msg: "getrawtransaction failed."}, 'sendFunds', projectInfo)
                        }
                        else {
                            newTx = new smartcash.TransactionBuilder()
                            
                            resp.vout.forEach(function(vout, voutIndex) {
                                if (vout.scriptPubKey.addresses.includes(projectInfo.fromAddr)) {
                                    //console.log('vout: ', vout)
                                    newTx.addInput(txid, vout.n)
                                }
                            })

                            newTx.addOutput(receiver, projectInfo.amount)
                            newTx.sign(0, sender)

                            //console.log('tx: ', newTx)

                            // add to local blockchain
                            console.log('newTx.toHex(): ', newTx.toHex())
                            console.log('newTx.build().toHex(): ', newTx.build().toHex())

                            /*cmd = {
                                method: 'sendrawtransaction',
                                params: [txHex, false, false]
                            }

                            rpc.sendCmd(cmd, function(err, resp) {
                                console.log('sendFunds')
                                console.log(err)
                                console.log(resp)

                                if (err) {
                                    callback({type: 'error', msg: "sendrawtransaction failed."}, 'sendFunds', projectInfo)
                                }
                                else {
                                    callback({type: 'data', msg: resp}, 'sendFunds', projectInfo)
                                }
                            })*/
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
    checkBalance: checkBalance,
    checkTransaction: checkTransaction,
    generateAddress: generateAddress,
    getAddressInfo: getAddressInfo,
    sendFunds: sendFunds,
    sweepFunds: sweepFunds
};