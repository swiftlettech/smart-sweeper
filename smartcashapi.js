/* Smart Cash API calls. */
const electron = require('electron')
const request = require('request')
const smartcash = require('smartcashjs-lib')
const rpc = require('./rpc-client')
const http = require('http')
const util = require('util')
const {watch} = require('melanke-watchjs')
const Store = require('electron-store')
const smartcashExplorer = "http://explorer3.smartcash.cc"

let db = new Store({name: "smart-sweeper"})
global.smartcashCallbackInfo = new Map() // keeps track of API callback vars per function call

/* Generic API callback function. */
let smartcashCallback = function(resp, functionName, projectInfo) {    
    var referrer = projectInfo.referrer
    var apiCallbackInfo = global.smartcashCallbackInfo.get(referrer+projectInfo.projectID)
    console.log('referrer: ', referrer)
    console.log('apiCallbackInfo: ', apiCallbackInfo)
    console.log('resp: ', resp)
    console.log()
    
    if (resp.type === "data") {
        if (functionName === "sweepFunds") {
            if (referrer === "getaddress") {
                if (parseInt(resp.msg.body.balance) == 0) {
                    apiCallbackInfo.project.recvAddrs.forEach(function(address, key) {
                        if (address.publicKey == resp.msg.body.address)
                            address.claimed = true
                    })
                }
            }
        }
        
        // once all of a project's promotional wallets have been processed, send data back to the initiator
        apiCallbackInfo.apiCallbackCounter++
        var apiCallbackCounter = apiCallbackInfo.apiCallbackCounter
        
        if (functionName === "sweepFunds") {
            if ((referrer === "getaddress") && (apiCallbackCounter == apiCallbackInfo.totalAddrs)) {
                global.smartcashCallbackInfo.checkAddrFlag = true
                global.availableProjects.list[projectInfo.projectIndex] = project // update project info
                console.log(global.availableProjects.list[projectInfo.projectIndex])
                //db.set('projects', global.availableProjects)
            }
        }
    }
    else if (resp.type === "error") {
        console.log('error msg: ', resp.msg)
        
        if (projectInfo.projectName) {
            global.sharedObject.logger.error(functionName + ': ' + resp.msg + " project " + projectInfo.projectName)
        }
        else {
            global.sharedObject.logger.error(functionName + ': ' + resp.msg)
        }
    }
}


/* Check a SmartCash address for validity. */
function checkAddress(address) {    
    try {
        smartcash.address.fromBase58Check(address)
        return true
    }
    catch(err) {
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
        if (projectInfo.referrer !== "checkFundingTxids")
            global.smartcashCallbackInfo.delete(projectInfo.referrer)
        
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

                        if (global.smartcashCallbackInfo.get(projectInfo.referrer).txCounter == txArray.length) {
                            callback({type: 'data', msg: global.smartcashCallbackInfo.get(projectInfo.referrer).confirmedTxFlag}, 'checkTransaction', projectInfo)
                            global.smartcashCallbackInfo.delete(projectInfo.referrer)
                        }
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

/* Sweep (send) funds back from the promotional wallet addresses. */
function sweepFunds(projectInfo, callback) {
    var project = projectInfo.project
    projectInfo.projectName = project.name
    var receiver = project.sweepAddr
    
    if (global.smartcashCallbackInfo.get('getaddress'+project.id) === undefined) {
        global.smartcashCallbackInfo.set('getaddress'+project.id, {
            apiCallbackCounter: 0,
            totalAddrs: project.recvAddrs.length,
            project: project
        })
    }
    
    //console.log(global.smartcashCallbackInfo)
    
    // check the balance of each "unclaimed" promotional wallet
    projectInfo.referrer = "getaddress"
    project.recvAddrs.forEach(function(address, key) {
        request({
            url: smartcashExplorer + '/ext/getaddress/' + address.publicKey,
            method: 'GET',
            json: true
        }, function (err, resp, body) {            
            if (resp) {
                smartcashCallback({type: 'data', msg: resp}, 'sweepFunds', projectInfo)
            }
            else {
                callback({type: 'error', msg: err}, 'sweepFunds', projectInfo)
            }
        })
    })
    
    watch(global.smartcashCallbackInfo, function(property, action, newValue, oldValue) {
        console.log(property)
        console.log(oldValue)
        console.log(newValue)
        console.log()
        
        // actually perform the sweep once the status of all the promotional wallets has been updated
        /*if ((property === "checkAddrFlag") && (newValue == true)) {
            //unclaimedWallets = []
            var activeProject = global.smartcashCallbackInfo.get(referrer+projectInfo.projectID)
            activeProject.recvAddrs.forEach(function(address, addressKey) {
            })
            
            // activeProject.sweepAddr
            global.smartcashCallbackInfo.delete(referrer+projectInfo.projectID)
        }*/
    })
    
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