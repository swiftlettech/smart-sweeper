(function() {
    'use strict';
    
    const config = window.nodeRequire("exp-config")
    const electron = window.nodeRequire('electron');
    const remote = electron.remote;
    const {ipcRenderer} = electron;
    const path = window.nodeRequire('path')
    const cp = window.nodeRequire('child_process');
    const {is} = window.nodeRequire('electron-util');
    const ps = window.nodeRequire('ps-node');
    const winston = window.nodeRequire('winston');
    const smartcashapi = window.nodeRequire('./smartcashapi');
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
        // load smartcash and the RPC explorer
        //https://smartcash.freshdesk.com/support/solutions/articles/35000038702-smartcash-conf-configuration-file
        // instructions to update smartcash config (txindex=1/server=1/rpcuser=rpcusername/rpcpassword=rpcpassword)
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
                /*else {
                    // is running
                    // check the arguments to see if the RPC server arg is present and get the process object
                    smartcash = results[0]

                    var hasArgs = false
                    if (smartcash.arguments !== "") {
                        var argCount = 0

                        smartcash.arguments.forEach(function(arg, index) {
                            if (arg === "-txindex=1" || arg === "-server" || arg === "-rpcuser=rpcusername" || arg === "-rpcpassword=rpcpassword")
                                argCount++;
                        })

                        if (argCount >= 4)
                            hasArgs = true
                    }

                    // show an error popup if all of the arguments aren't present
                    if (!hasArgs) {
                        var content = {
                            text: {
                                title: 'Missing configuration',
                                body: 'Your Smartcash wallet was not started with the -txindex=1, -server, -rpcuser=rpcusername, and -rpcpassword=rpcpassword arguments. SMART Sweeper will now exit.'
                            },
                            fatal: true
                        }
                        ipcRenderer.send('showErrorDialog', content);
                        return;
                    }
                    else {
                        remote.getGlobal('sharedObject').coreRunning = true;
                        rpcExplorerCheck()
                    }
                }*/

                // periodic background checking for online connectivity, SmartCash Core, and the RPC Explorer
                setInterval(() => {
                    //checkOnlineStatus()
                    //smartcashCoreCheck()
                    //rpcCheck()
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
                rpcConnected = true
                remote.getGlobal('sharedObject').rpcConnected = true;

                // check to see if the local copy of the blockchain is current
                //smartcashapi.getBlockCount(rpcConnected, apiCallback);

                // automatically sweep funds if necessary
                //autoSweepFunds();
            }
        }
        else if (resp.type === "error") {
            logger.error(functionName + ': ' + resp.msg)

            if (functionName === "rpcCheck") {
                remote.getGlobal('sharedObject').rpcError = true;
                
                //splashScreen.close()
                //splashScreen = null

                /*var content = {
                    title: 'Error',
                    body: 'Unable to connect to the RPC explorer. Is there a web server running?'
                }
                createDialog(null, win, 'error', content, true)*/
            }
        }
        
        apiCallbackCounter++        
    }
    
    function rpcCheck() {
        rpc.statusCheck(function(resp) {
            if (!resp)
                apiCallback({type: 'error'}, 'rpcCheck')
            else
                apiCallback({type: 'data'}, 'rpcCheck')
        })
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
        })

        smartcash.unref()
        smartcash.on('error', (err) => {
            console.log('tried to open the wallet and failed')
            console.log(err)
            logger.error('appInit - start Smartcash core: ' + err)
            remote.getGlobal('sharedObject').coreError = true;
        })
        
        setTimeout(() => {
            if (!remote.getGlobal('sharedObject').coreError) {
                remote.getGlobal('sharedObject').coreRunning = true;
                rpcCheck()
            }
        }, 20000)
    }

    // check to see whether or not the user is online
    function checkOnlineStatus() {
        isOnline().then(online => {
            remote.getGlobal('sharedObject').isOnline = online;
        })
    }    
})();