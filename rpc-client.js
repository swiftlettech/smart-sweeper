const fs = require('fs')
const os = require('os')
let config = require("exp-config")
const electron = require('electron')
const {ipcRenderer} = electron
//const winston = require('winston')
const bitcoin = require('bitcoin')

let client

//let logger = winston.loggers.get('logger')

// check for existing config file, create it if it doesn't exist    
try {
    fs.openSync('.env', 'r')
    
    client = new bitcoin.Client({
        host: config.rpc.host,
        port: config.rpc.port,
        user: config.rpc.username,
        pass: config.rpc.password,
        timeout: 30000
    })
}
catch(err) {    
    if (err.code === "ENOENT") {
        var smartcashPath
        
        var content = "rpc.host=127.0.0.1\n"
        content += "rpc.port=9678\n"
        content += "rpc.username=rpcusername\n"
        content += "rpc.password=rpcpassword\n"
        
        if (os.platform() === "win32")
            smartcashPath = "C:\\Program Files\\SmartCash\\"
        //else if (os.platform() === "linux")
        //else if (os.platform() === "darwin")
            
        content += "smartcashPath=" + smartcashPath + "\n"
        
        fs.writeFileSync('.env', content)
        
        config = { rpc: {} }
        
        config.rpc.host = "127.0.0.1"
        config.rpc.port = "9678"
        config.rpc.username = "rpcusername"
        config.rpc.password = "rpcpassword"
        config.smartcashPath = smartcashPath
        
        client = new bitcoin.Client({
            host: config.rpc.host,
            port: config.rpc.port,
            user: config.rpc.username,
            pass: config.rpc.password,
            timeout: 30000
        })
    }
    else {
        var content = {
            text: {
                title: 'Error',
                body: 'The configuration file cannot be loaded. SMART Sweeper will now exit.'
            },
            fatal: true
        }            
        ipcRenderer.send('showErrorDialog', content);
    }
}

// send a command to the RPC server
function sendCmd(cmd, callback) {
    client.cmd(cmd.method, cmd.params, function(err, result, resHeaders) {
        //console.log(result)
        //console.log(err)
        //console.log(resHeaders)

        if (err)
            callback(true, err)
        else
            callback(false, result)
    });
}

// checks to see whether or not the client can communicate with the core
function statusCheck(callback) {
    var cmd = {
        method: 'getblockcount',
        params: []
    }
    
    sendCmd(cmd, function(err, resp) {
        if (!err)
            callback(resp)
        else
            callback(err)
    })
}

module.exports = {
    sendCmd: sendCmd,
    statusCheck: statusCheck
}