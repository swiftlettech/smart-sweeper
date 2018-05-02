//require("config")
//const winston = require('winston')
const bitcoin = require('bitcoin')

//let logger = winston.loggers.get('logger')

let smartcashd = {
    host: "127.0.0.1",
    port: 9678,
    rpc: {
        username: "rpcusername",
        password: "rpcpassword"
    }
}

const client = new bitcoin.Client({
    host: smartcashd.host,
    port: smartcashd.port,
    user: smartcashd.rpc.username,
    pass: smartcashd.rpc.password,
    timeout: 30000
})

function disconnect() {
    //client
}

// send a command to the RPC server
function sendCmd(cmd, callback) {
    if (cmd.param2 === undefined) {
        client.cmd(cmd.method, cmd.param1, function(err, result, resHeaders) {
            console.log(result)
            console.log(err)
            console.log(resHeaders)

            if (err)
                callback(true, err)
            else
                callback(false, result)
        });
    }
    else if (cmd.param1 === undefined) {
        client.cmd(cmd.method, cmd.param1, cmd.param2, function(err, result, resHeaders) {
            console.log(result)
            console.log(err)
            console.log(resHeaders)

            if (err)
                callback(true, err)
            else
                callback(false, result)
        });
    }
    else {
        client.cmd(cmd.method, function(err, result, resHeaders) {
            console.log(result)
            console.log(err)
            console.log(resHeaders)

            if (err)
                callback(true, err)
            else
                callback(false, result)
        });
    }
}

// checks to see whether or not the client can communicate with the core
function statusCheck(callback) {
    var cmd = {
        method: 'getblockchaininfo'
    }    
    
    console.log('statusCheck');
    
    sendCmd(cmd, function(err, resp) {
        console.log(resp)
        //callback(err)
    })
}

module.exports = {
    disconnect: disconnect,
    sendCmd: sendCmd,
    statusCheck: statusCheck
}