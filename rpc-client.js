//require("config");
//const electron = require('electron');
//const remote = electron.remote;
const Client = require('bitcoin-core');

function connect() {
    var smartcashd = {
		host: "127.0.0.1",
		port: 9678,
		rpc: {
			username: "rpcusername",
			password: "rpcpassword"
		}
	};
    
    var client = new Client({
        host: smartcashd.host,
        port: smartcashd.port,
        username: smartcashd.username,
        password: smartcashd.password,
        timeout: 30000
    });

    global.sharedObject.client = client;
    
    console.log(global.sharedObject);
}

function disconnect() {
    
}

module.exports = {
    connect: connect,
    disconnect: disconnect
};