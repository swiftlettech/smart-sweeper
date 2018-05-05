(function() {
    'use strict';
    
    const config = window.nodeRequire("exp-config")
    const electron = window.nodeRequire('electron');
    const remote = electron.remote;
    const {ipcRenderer} = electron;
    const path = window.nodeRequire('path')
    const cp = window.nodeRequire('child_process');
    
    const request = window.nodeRequire('request')
    const {is} = window.nodeRequire('electron-util');
    const ps = window.nodeRequire('ps-node');
    const winston = window.nodeRequire('winston');
    const smartcashapi = window.nodeRequire('./smartcashapi');
    const smartcashExplorer = "http://explorer3.smartcash.cc"
    const rpc = window.nodeRequire('./rpc-client');
    
    let logger = winston.loggers.get('logger');
    //console.log(logger)
    var basepath = __dirname.split(path.sep);
    basepath.pop();
    basepath = basepath.join(path.sep);
    
    var apiCallbackCounter, isOnlineFlag;
    var smartcashProg, smartcashPath, smartcash, rpcExplorer, rpcConnected;
    
    init();
    
    function init() {
        //global.bgApiCallbackInfo = new Map() // keeps track of API callback vars per function call
        
        // load smartcash and the RPC explorer
        if (is.windows) {
            smartcashProg = "smartcash-qt.exe"
        }
        else if (is.linux || is.macos) {
            smartcashProg = "smartcash-qt"
        }
        else {
            var content = {
                text: {
                    title: 'Error',
                    body: 'I\'m sorry, SMART Sweeper is not supported on your operating system.'
                },
                fatal: true
            }            
            ipcRenderer.send('showErrorDialog', content);
            return;
        }

        // check to see if smartcash is already running
        ps.lookup({command: smartcashProg}, function (err, results) {            
            if (err) {
               throw new Error(err)
            }
            else {                
                if (results.length == 0) {
                    // not running
                    startSmartcashCore()
                }
                else {
                    remote.getGlobal('sharedObject').coreRunning = true;
                    rpcCheck()
                }

                // periodic background checking for online connectivity, SmartCash Core, and the RPC Explorer
                setInterval(() => {
                    //checkOnlineStatus()
                    //smartcashCoreCheck()
                    //rpcCheck()
                    //checkBlockchain(apiCallback)
                }, 30000)
            }
        })
    }
    
    /* Generic API callback function. */
    let apiCallback = function(resp, functionName) {
        if (resp.type === "data") {
            console.log('from ' + functionName);
            console.log(resp);
            
            if (functionName === "rpcCheck") {
                rpcConnected = true;
                remote.getGlobal('sharedObject').rpcConnected = true;

                // check to see if the local copy of the blockchain is current
                checkBlockchain(apiCallback);
                //smartcashapi.getBlockCount(rpcConnected, apiCallback);

                // automatically sweep funds if necessary
                //autoSweepFunds();
            }
        }
        else if (resp.type === "error") {
            logger.error(functionName + ': ' + resp.msg);

            if (functionName === "rpcCheck") {
                remote.getGlobal('sharedObject').rpcError = true;
            }
        }
        
        apiCallbackCounter++        
    }
    
    /* Syncs SmartCash core if behind. */
    function coreSync(callback) {        
        var cmd = {
            method: 'snsync',
            params: ['next']
        };
        
        rpc.sendCmd(cmd, function(err, resp) {
            if (err) {
                callback({type: 'error', msg: resp}, 'coreSync')
            }
            else {
                console.log(resp);
            }
        });
    }
    
    /* Get the current block count. */
    function checkBlockchain(callback) {
        var localHeaderCount;
        var localBlockCount;
        var onlineBlockCount;
        var valid = 0;
        
        var cmd = {
            method: 'getblockchaininfo',
            params: []
        };
        
        // check the local blockchain regardless of internet connection status
        rpc.sendCmd(cmd, function(err, resp) {
            if (err) {
                callback({type: 'error', msg: resp}, 'getBlockCount')
            }
            else {
                localHeaderCount = resp.headers
                localBlockCount = resp.blocks
                
                if (localHeaderCount == localBlockCount)
                    valid++;
                
                // there is an active internet connection, check the online block explorer
                if (remote.getGlobal('sharedObject').isOnline) {
                    request({
                        url: smartcashExplorer + '/api/getblockcount',
                        method: 'GET'
                    }, function (err, resp, body) {
                        if (resp && resp.body) {
                            onlineBlockCount = parseInt(resp.body);

                            if (localHeaderCount == onlineBlockCount);
                                valid++

                            if (valid == 2)
                                remote.getGlobal('sharedObject').coreSynced = true;
                            //else
                                //coreSync(apiCallback);

                            //callback({type: 'data', msg: true}, 'getBlockCount');
                        }
                        else {
                            console.log('getBlockCount');
                            console.log(err);

                            if (err)
                                callback({type: 'error', msg: err}, 'getBlockCount');
                        }
                    });
                }
                else {
                    if (valid == 1)
                        remote.getGlobal('sharedObject').coreSynced = true;
                    
                    /*if (!validFlag)
                        coreSync(apiCallback);*/
                }
            }
        });
    }
    
    function rpcCheck() {
        rpc.statusCheck(function(resp) {
            if (!resp)
                apiCallback({type: 'error'}, 'rpcCheck');
            else
                apiCallback({type: 'data'}, 'rpcCheck');
        });
    }
    
    // check to see if Smartcash Core is running
    function smartcashCoreCheck() {
        ps.lookup({command: smartcashProg}, function (err, results) {
            if (err) {
               throw new Error(err);
            }
            else {
                if (results.length != 0) {
                    remote.getGlobal('sharedObject').coreRunning = true;
                    rpcCheck();
                }
                else
                    remote.getGlobal('sharedObject').coreRunning = false;
            }
        });
    }

    function startSmartcashCore() {
        console.log(config.smartcashPath);
        
        smartcash = cp.spawn(config.smartcashPath + smartcashProg, ['-txindex=1', '-server', '-rpcbind='+config.rpc.host, '-rpcport='+config.rpc.port, '-rpcuser='+config.rpc.username, '-rpcpassword='+config.rpc.password], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });

        smartcash.unref();
        smartcash.on('error', (err) => {
            console.log('tried to open the wallet and failed');
            console.log(err);
            logger.error('appInit - start Smartcash core: ' + err);
            remote.getGlobal('sharedObject').coreError = true;
        });
        
        setTimeout(() => {
            if (!remote.getGlobal('sharedObject').coreError) {
                remote.getGlobal('sharedObject').coreRunning = true;
                rpcCheck();
            }
        }, 20000);
    }

    // check to see whether or not the user is online
    function checkOnlineStatus() {
        isOnline().then(online => {
            remote.getGlobal('sharedObject').isOnline = online;
        });
    }    
})();