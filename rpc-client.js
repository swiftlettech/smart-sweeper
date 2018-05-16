const fs = require('fs')
const os = require('os')
let config = require("exp-config")
const electron = require('electron')
const {ipcRenderer} = electron
const smartcash = require('./smartcash-client')

let client

// check for existing config file, create it if it doesn't exist
try {
    fs.openSync('.env', 'r')
    
    client = new smartcash.Client({
        host: config.rpc.host,
        port: config.rpc.port,
        user: config.rpc.username,
        pass: config.rpc.password,
        timeout: 30000
    })
}
catch(err) {
    if (err.code === "ENOENT") {
        var defaultSmartcashPath
        
        var content = "rpc.host=127.0.0.1\n"
        content += "rpc.port=9678\n"
        content += "rpc.username=rpcusername\n"
        content += "rpc.password=rpcpassword\n"
        
        if (os.platform() === "win32")
            defaultSmartcashPath = "C:\\Program Files\\SmartCash\\"
        //else if (os.platform() === "linux")
        //else if (os.platform() === "darwin")
            
        content += "smartcashPath=" + defaultSmartcashPath
        
        fs.writeFileSync('.env', content)
        
        config = { rpc: {} }
        
        config.rpc.host = "127.0.0.1"
        config.rpc.port = "9678"
        config.rpc.username = "rpcusername"
        config.rpc.password = "rpcpassword"
        config.smartcashPath = defaultSmartcashPath
        
        client = new smartcash.Client({
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
                body: 'The configuration file cannot be loaded. SmartSweeper will now exit.'
            },
            fatal: true
        }            
        ipcRenderer.send('showErrorDialog', content)
    }
}

// send a command to the RPC server
function sendCmd(cmd, callback) {
    client.cmd(cmd.method, cmd.params, function(err, result, resHeaders) {
        //console.log('sendCmd')
        //console.log(result)
        //console.log(err)
        //console.log(resHeaders)

        if (err)
            callback(true, err)
        else
            callback(false, result)
    })
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