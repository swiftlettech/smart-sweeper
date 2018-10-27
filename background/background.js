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
    const unhandled = window.nodeRequire('electron-unhandled');
    const Store = window.nodeRequire('electron-store');
    const ps = window.nodeRequire('ps-node');
    const smartcashapi = window.nodeRequire('./smartcashapi');
    const rpc = window.nodeRequire('./rpc-client');
    const smartcashExplorer = "https://insight.smartcash.cc/api";
    
    // get the parent dir
    var basepath = __dirname.split(path.sep);
    basepath.pop();
    basepath = basepath.join(path.sep);
    
    let apiCallbackCounter;
    let smartcashProg, smartcashPath, smartcash;
    let db = new Store({name: "smart-sweeper"});
    
    init();
    
    function init() {        
        // catch unhandled exceptions
        unhandled({
            logger: function(err) {
                electron.remote.getGlobal('sharedObject').exceptionLogger.error(err.stack);
                
                console.log(err.message);
                
                // the "EPERM operation not permitted error" is fatal (https://github.com/sindresorhus/electron-store/issues/31)
                if (err.message.indexOf('EPERM') != -1) {
                    var content = {
                        text: {
                            title: 'Error',
                            body: 'SmartSweeper has encountered a fatal error. The app will now close.'
                        },
                        fatal: true
                    };
                    ipcRenderer.send('showErrorDialog', content);
                }
            },
            showDialog: true
        });
        
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
                
                // check address balances once per minute to try to avoid block explorer connection issues
                setInterval(() => {
                    ipcRenderer.send('getClaimedFundsInfo');
                    ipcRenderer.send('getSweptTxStatus');
                    ipcRenderer.send('getSweptFundsInfo');
                    ipcRenderer.send('getWalletTxStatus');
                }, 60000);
            }
        })
    }
    
    /* Generic API callback function. */
    let apiCallback = function(resp, functionName) {
        if (resp.type === "data") {
            //console.log('from ' + functionName);
            //console.log(resp);
            
            //remote.getGlobal('sharedObject').sysLogger.info(functionName + ': ' + resp.msg);
            
            if (functionName === "rpcCheck") {
                remote.getGlobal('sharedObject').rpcConnected = true;
                remote.getGlobal('sharedObject').rpcError = false;

                // check to see if the local copy of the blockchain is current
                checkBlockchain();
                // get the transaction status of all projects
                ipcRenderer.send('getProjectTxStatus');
            }
            else if (functionName === "checkBlockchain1") {
                remote.getGlobal('sharedObject').rpcConnected = true;
                remote.getGlobal('sharedObject').rpcError = false;
            }
            else if (functionName === "checkBlockchain2") {
                remote.getGlobal('sharedObject').blockExplorerError = false;
                
                // automatically sweep funds if necessary if the blockchain is up-to-date
                //if (resp.msg) {
                    //autoSweep()
                //}
            }
        }
        else if (resp.type === "error") {
            /*console.log('background.js error')
            console.log('functionName: ', functionName)
            console.log('resp.msg: ', resp.msg)*/
            remote.getGlobal('sharedObject').sysLogger.error(functionName + ': ' + resp.msg);

            if (functionName === "rpcCheck" || functionName === "checkBlockchain1") {
                remote.getGlobal('sharedObject').rpcError = true;
                remote.getGlobal('sharedObject').rpcConnected = false;
            }
            else if (functionName === "checkBlockchain2") {
                remote.getGlobal('sharedObject').blockExplorerError = true;
            }
        }
        
        apiCallbackCounter++        
    }
    
    /* Auto-sweep funds. NOT USED */
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
            //console.log('checkBlockchain local')
            //console.log(resp)
            
            if (err) {
                apiCallback({type: 'error', msg: resp}, 'checkBlockchain1');
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
                        url: smartcashExplorer + '/status?q=getInfo',
                        method: 'GET'
                    }, function (err, resp, body) {
                        //console.log('checkBlockchain remote')
                        //console.log('err: ', err)
                        //console.log('resp.body: ', resp.body)
                        //console.log('body: ', body)
                        
                        if (resp && (resp.headers['content-type'].indexOf('json') != -1) && (typeof body === "string"))
                            body = JSON.parse(body)

                        if (resp && err == null && body.error === undefined) {
                            var onlineBlockCount = body.info.blocks;

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
                            console.log('checkBlockchain error');
                            console.log('err: ' + err);
                            console.log('body.error: ' + body.error);
                            
                            var error
                            
                            if (err)
                                error = err
                            else if (body.error)
                                error = body.error
                            else
                                error = body
                            
                            remote.getGlobal('sharedObject').blockExplorerError = true;
                            apiCallback({type: 'error', msg: error}, 'checkBlockchain2');
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
        rpc.rpcCheck(function(resp) {            
            if (resp.err)
                apiCallback({type: 'error', msg: resp.msg}, 'rpcCheck');
            else
                apiCallback({type: 'data', msg: true}, 'rpcCheck');
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
            windowsHide: false
        });

        smartcash.unref();
        smartcash.on('error', (err) => {
            console.log('tried to open the node client and failed');
            console.log(err);
            remote.getGlobal('sharedObject').sysLogger.error('appInit - start Smartcash core: ' + err);
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
        // update a project's currentFunds property
        ipcRenderer.send('checkProjectBalances');
    }
})();