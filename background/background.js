(function() {
    'use strict';
    
    const config = window.nodeRequire("exp-config");
    const electron = window.nodeRequire('electron');
    const remote = electron.remote;
    const {ipcRenderer} = electron;
    const path = window.nodeRequire('path');
    const cp = window.nodeRequire('child_process');
    
    const request = window.nodeRequire('request');
    const {is} = window.nodeRequire('electron-util');
    const isOnline = window.nodeRequire('is-online');
    const Store = window.nodeRequire('electron-store')
    const ps = window.nodeRequire('ps-node');
    const smartcashapi = window.nodeRequire('./smartcashapi');
    const smartcashExplorer = "https://smart.ccore.online";
    const rpc = window.nodeRequire('./rpc-client');
    
    var basepath = __dirname.split(path.sep);
    basepath.pop();
    basepath = basepath.join(path.sep);
    
    let apiCallbackCounter, isOnlineFlag;
    let smartcashProg, smartcashPath, smartcash;
    let db = new Store({name: "smart-sweeper"});
    
    init();
    
    function init() {
        //global.bgApiCallbackInfo = new Map() // keeps track of API callback vars per function call
        
        // load smartcash and the RPC explorer
        if (is.windows) {
            smartcashProg = "smartcash-qt.exe";
        }
        else if (is.linux || is.macos) {
            smartcashProg = "smartcash-qt";
        }
        else {
            var content = {
                text: {
                    title: 'Error',
                    body: 'I\'m sorry, SmartSweeper is not supported on your operating system.'
                },
                fatal: true
            };
            ipcRenderer.send('showErrorDialog', content);
            return;
        }

        // check to see if SmartCash is already running
        ps.lookup({command: smartcashProg}, function (err, results) {            
            if (err) {
               throw new Error(err);
            }
            else {
                console.log("ps lookup results: ", results);
                if (results.length == 0) {
                    // not running
                    startSmartcashCore();
                }
                else {
                    remote.getGlobal('sharedObject').coreRunning = true;
                    rpcCheck();
                }

                // periodic background checking for online connectivity, SmartCash Core, and RPC connectivity
                setInterval(() => {
                    checkOnlineStatus();
                    smartcashCoreCheck();
                    
                    if (remote.getGlobal('sharedObject').coreRunning) {
                        rpcCheck();
                    
                        if (remote.getGlobal('sharedObject').rpcConnected) {
                            checkBlockchain();
                            updateData();
                        }
                    }
                }, 30000);
                
                // check address balances once per minute to avoid block explorer connection issues
                setInterval(() => {
                    ipcRenderer.send('getClaimedFundsInfo');
                    ipcRenderer.send('getWalletTxStatus');
                }, 60000);
            }
        })
    }
    
    /* Generic API callback function. */
    let apiCallback = function(resp, functionName) {
        if (resp.type === "data") {
            console.log('from ' + functionName);
            console.log(resp);
            
            if (functionName === "rpcCheck") {
                remote.getGlobal('sharedObject').rpcConnected = true;

                // check to see if the local copy of the blockchain is current
                checkBlockchain();
                ipcRenderer.send('getProjectTxStatus');
            }
            else if (functionName === "checkBlockchain") {
                remote.getGlobal('sharedObject').blockExplorerError = false
                
                // automatically sweep funds if necessary if the blockchain is up-to-date
                //if (resp.msg) {
                    //autoSweep()
                //}
            }
        }
        else if (resp.type === "error") {
            remote.getGlobal('sharedObject').logger.error(functionName + ': ' + resp.msg);

            if (functionName === "rpcCheck")
                remote.getGlobal('sharedObject').rpcError = true;
        }
        
        apiCallbackCounter++        
    }
    
    /* Auto-sweep funds. */
    function autoSweep() {
        // auto sweep funds on startup
        
        // start 24 hour background process to check for projects past their auto sweep date
        /*setInterval(() => {
          }, );*/
    }
    
    /* Get the current block count as a way to see if the local blockchain is current. */
    function checkBlockchain() {
        var valid = 0;
        
        var cmd = {
            method: 'getblockchaininfo',
            params: []
        };
        
        // check the local blockchain regardless of internet connection status
        rpc.sendCmd(cmd, function(err, resp) {
            if (err) {
                apiCallback({type: 'error', msg: resp}, 'checkBlockchain');
            }
            else {
                var localHeaderCount = parseInt(resp.headers);
                var localBlockCount = parseInt(resp.blocks);
                
                //console.log('localHeaderCount: ', localHeaderCount);
                //console.log('localBlockCount: ', localBlockCount);
                //console.log('localHeaderCount == localBlockCount: ', localHeaderCount == localBlockCount);
                
                if (localHeaderCount == localBlockCount)
                    valid++;
                
                //console.log('valid #1: ', valid);
                
                // there is an active internet connection, also get the total block count from the online block explorer
                if (remote.getGlobal('sharedObject').isOnline) {
                    request({
                        url: smartcashExplorer + '/api/getblockcount',
                        method: 'GET'
                    }, function (err, resp, body) {
                        if (resp && resp.body) {
                            var onlineBlockCount = parseInt(resp.body);

                            if (localBlockCount == onlineBlockCount);
                                valid++
                            
                            //console.log('localBlockCount == onlineBlockCount: ', localBlockCount == onlineBlockCount);
                            //console.log('valid #2: ', valid);

                            if (valid == 2) {
                                remote.getGlobal('sharedObject').coreSynced = true;
                                remote.getGlobal('sharedObject').coreSyncError = false;
                                apiCallback({type: 'data', msg: true}, 'checkBlockchain');
                            }
                            else {
                                remote.getGlobal('sharedObject').coreSyncError = true;
                                remote.getGlobal('sharedObject').coreSynced = false;
                            }
                        }
                        else {
                            console.log('checkBlockchain');
                            console.log(err);

                            if (err) {
                                remote.getGlobal('sharedObject').blockExplorerError = true;
                                apiCallback({type: 'error', msg: err}, 'checkBlockchain');
                            }
                        }
                    });
                }
                else {
                    if (valid == 1) {
                        remote.getGlobal('sharedObject').coreSynced = true;
                        remote.getGlobal('sharedObject').coreSyncError = false;
                        apiCallback({type: 'data', msg: true}, 'checkBlockchain');
                    }
                    else {
                        remote.getGlobal('sharedObject').coreSynced = false;
                        remote.getGlobal('sharedObject').coreSyncError = true;
                    }
                }
            }
        });
    }
    
    /* Check to see whether or not the user is online. */
    function checkOnlineStatus() {
        isOnline().then(online => {
            remote.getGlobal('sharedObject').isOnline = online;
        });
    }
    
    /* Check to see if the RPC client can communicate with SmartCash. */
    function rpcCheck() {
        rpc.statusCheck(function(resp) {
            if (!resp)
                apiCallback({type: 'error'}, 'rpcCheck');
            else {
                apiCallback({type: 'data'}, 'rpcCheck');
            }
        });
    }
    
    // check to see if SmartCash Core is running
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
                else {
                    remote.getGlobal('sharedObject').coreRunning = false;
                    remote.getGlobal('sharedObject').coreError = true;
                }
            }
        });
    }

    // start SmartCash and detach it from SmartSweeper so that it doesn't close when SmartSweeper does
    function startSmartcashCore() {        
        smartcash = cp.spawn(config.smartcashPath + smartcashProg, ['-txindex=1', '-server', '-rpcbind='+config.rpc.host, '-rpcport='+config.rpc.port, '-rpcuser='+config.rpc.username, '-rpcpassword='+config.rpc.password], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });

        smartcash.unref();
        smartcash.on('error', (err) => {
            console.log('tried to open the wallet and failed');
            console.log(err);
            remote.getGlobal('sharedObject').logger.error('appInit - start Smartcash core: ' + err);
            remote.getGlobal('sharedObject').coreError = true;
        });
        
        setTimeout(() => {
            if (!remote.getGlobal('sharedObject').coreError) {
                remote.getGlobal('sharedObject').coreRunning = true;
                rpcCheck();
            }
        }, 30000);
    }
    
    /* Update various info. */
    function updateData() {
        // dashboard info
        ipcRenderer.send('checkProjectBalances');

        // update a project's txConfirmed flag
        ipcRenderer.send('getAllTxStatus');
    }
})();