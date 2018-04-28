(function() {
    'use strict';
    
    const electron = window.nodeRequire('electron');
    const remote = electron.remote;
    const {ipcRenderer} = electron;
    const path = window.nodeRequire('path')
    const cp = window.nodeRequire('child_process');
    const {is} = window.nodeRequire('electron-util');
    const ps = window.nodeRequire('ps-node');
    const winston = window.nodeRequire('winston');
    const smartcashapi = window.nodeRequire('./smartcashapi');
    
    let logger = winston.loggers.get('logger');
    var basepath = __dirname.split(path.sep);
    basepath.pop();
    basepath = basepath.join(path.sep);
    
    var apiCallbackCounter, isOnlineFlag;
    var smartcashProg, smartcashPath, smartcash, rpcExplorer, rpcExplorerConnected;
    
    init();
    
    function init() {
        // load smartcash and the RPC explorer
        //https://smartcash.freshdesk.com/support/solutions/articles/35000038702-smartcash-conf-configuration-file
        // instructions to update smartcash config (txindex=1/server=1/rpcuser=rpcusername/rpcpassword=rpcpassword)
        if (is.windows) {
            smartcashPath = "C:\\Program Files\\SmartCash Core\\"
            smartcashProg = "smartcash-qt.exe"
        }
        else if (is.linux) {
            smartcashPath = ""
            smartcashProg = "smartcash-qt"
        }
        else if (is.macos) {
            smartcashPath = ""
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

                        if (argCount == 4)
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
                }

                // periodic background checking for online connectivity, SmartCash Core, and the RPC Explorer
                setInterval(() => {
                    //checkOnlineStatus()
                    //smartcashCoreCheck()
                    //rpcExplorerCheck()
                }, 30000)
            }
        })
    }
    
    /* Generic API callback function. */
    let apiCallback = function(resp, functionName, projectInfo) {
        if (resp.type === "data") {
            console.log('from ' + functionName);
            console.log(resp);
            
            if (functionName === "connRpcExplorer") {
                rpcExplorerConnected = true
                
                console.log(remote.getGlobal('sharedObject'))
                remote.getGlobal('sharedObject').referrer = "";
                remote.getGlobal('sharedObject').client = resp.msg.client;
                remote.getGlobal('sharedObject').rpcExplorerRunning = true;
                remote.getGlobal('sharedObject').win.webContents.send('rpcClientCreated');

                // check to see if the local copy of the blockchain is current
                //smartcashapi.getBlockCount(rpcExplorerConnected, apiCallback);

                // automatically sweep funds if necessary
                //autoSweepFunds();
            }
        }
        else if (resp.type === "error") {
            if (projectInfo)
                logger.error(functionName + ': ' + resp.msg + "project " + projectInfo.projectName)
            else
                logger.error(functionName + ': ' + resp.msg)

            if (functionName === "connRpcExplorer") {
                remote.getGlobal('sharedObject').rpcExplorerError = true;
                
                //splashScreen.close()
                //splashScreen = null

                /*var content = {
                    title: 'Error',
                    body: 'Unable to connect to the RPC explorer. Is there a web server running?'
                }
                createDialog(null, win, 'error', content, true)
                
                remote.getGlobal('win').webContents.send('rpcExplorerCheck', {rpcExplorer: false})*/
            }
        }
        
        apiCallbackCounter++
        
        
    }
    
    // check to see if the RPC explorer is running and is connected to Smartcash Core
    function rpcExplorerCheck() {
        ps.lookup({command: 'node'}, function (err, results) {
            var explorerRunning = false

            results.forEach(function(result, index) {
                if (result.arguments.length == 1 && result.arguments[0].indexOf('rpc-explorer') != -1)
                    explorerRunning = true
            })

            if (!explorerRunning)
                startRpcExplorer()
        })
    }
    
    function startRpcExplorer() {
        rpcExplorer = cp.fork(path.join(basepath, 'rpc-explorer/bin/www'), [], {})
        rpcExplorer.on('error', (err) => {
            logger.error('startRpcExplorer: ' + err)
        })
        rpcExplorer.on('message', (resp) => {
            if (resp.msg === "success") {            
                rpcExplorerConnected = false
                smartcashapi.connRpcExplorer(apiCallback)
            }
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
                    rpcExplorerCheck();
                }
                else
                    remote.getGlobal('sharedObject').coreRunning = false;
            }
        });
    }

    function startSmartcashCore() {
        smartcash = cp.spawn(smartcashPath + smartcashProg, ['-txindex=1', '-server', '-rpcuser=rpcusername', '-rpcpassword=rpcpassword'], {
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

            /*var content = {
                title: 'Error',
                body: 'SmartCash could not load. SMART Sweeper will now exit.'
            }
            createDialog(null, win, 'error', content, true)*/
        })

        setTimeout(() => {
            remote.getGlobal('sharedObject').coreRunning = true;
            rpcExplorerCheck()
        }, 20000)
    }

    // check to see whether or not the user is online
    function checkOnlineStatus() {
        isOnline().then(online => {
            remote.getGlobal('sharedObject').isOnline = online;
            //remote.getGlobal('win').webContents.send('onlineCheck', {online: false})
        })
    }    
})();