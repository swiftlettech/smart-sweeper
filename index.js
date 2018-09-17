/* Main app logic. */
const electron = require('electron')
const {app, BrowserWindow, dialog, ipcMain, shell} = electron
const path = require('path')
const url = require('url')
const fs = require('fs')
const util = require('util')
const unhandled = require('electron-unhandled')

const winston = require('winston')
const Transport = require('winston-transport')
const {createLogger, format, transports} = winston
const {combine, timestamp, prettyPrint} = format

const Store = require('electron-store')
const smartcashapi = require('./smartcashapi')
const {watch} = require('melanke-watchjs')

const baseLogPath = "logs"
const sysLogsPath = baseLogPath + path.sep + 'system'
const userLogsPath = baseLogPath + path.sep + 'user'
const isDev = require('electron-is-dev')
require('electron-debug')({showDevTools: true})

let splashScreen, bgWin, modal, modalType, logFile, db, savedAppData

// create a custom transport to save winston logs into a json database using electron store
module.exports = {
    JsonDBTransport: class JsonDBTransport extends Transport {
        constructor(options) {
            super(options)
            
            if (options.label === "exception") {
                // exceptions log
                this.logDBExceptions = new Store({name: options.filename})
                
                if (this.logDBExceptions.get('log') === undefined)
                    this.logDBExceptions.set('log', [])
            }
            else if (options.label === "system") {
                // system log
                 this.logDBSystem = new Store({name: options.filename})
                //console.log(this.logDBSystem)

                if (this.logDBSystem.get('log') === undefined)
                    this.logDBSystem.set('log', [])
            }
            else if (options.label === "user") {
                // user log
                this.logDBUser = new Store({name: options.filename})
                //console.log(this.logDBUser)

                if (this.logDBUser.get('log') === undefined)
                    this.logDBUser.set('log', [])
            }
        }

        log(info, callback) {
            var self = this
            
            setImmediate(function () {
                self.emit('logged', info)
            })
            
            var logDB
            
            //console.log(info)
            //console.log(self)
            
            if (self.logDBSystem !== undefined)
                logDB = self.logDBSystem
            else if (self.logDBExceptions !== undefined)
                logDB = self.logDBExceptions
            else if (self.logDBUser !== undefined)
                logDB = self.logDBUser
            
            if (logDB !== undefined) {
                var log = logDB.get('log')
                log.push(info)
                logDB.set('log', log)
            }
            
            if (callback && typeof callback === "function")
                callback()
        }
    }
}

// init various things before the main window loads
function appInit() {
    // global task status object to be used in the renderer
    global.taskStatus = new Map();
    
    // fee tiers for SmartCash transactions, based on number of promo wallets
    var txFeeTiers = {
        "1-10": 0.001,
        "11-50": 0.01,
        "51-100": 0.02,
        "101-200": 0.03,
        "201-300": 0.04,
        "301-400": 0.05,
        "401-500": 0.06
    }
    
    // global object to be shared amongst renderer processes
    global.sharedObject = {
        config: null,
        version: null,
        txBaseFee: 0.001, // minimum transaction fee
        txFeeTiers: txFeeTiers,
        explorerCheckInterval: 1.2, // minimum time between block explorer requests
        win: null,
        logger: null,
        sysLogger: null,
        exceptionLogger: null,
        isOnline: false,
        referrer: "",
        coreRunning: false,
        coreError: false,
        rpcConnected: false,
        rpcError: false,
        coreSynced: false,
        coreSyncError: false,
        blockExplorerError: false
    }
    
    // watch for changes on the shared object
    watch(global.sharedObject, function(property, action, newValue, oldValue) {
        //console.log(property)
        //console.log(oldValue)
        //console.log(newValue)
        //console.log()
        
        var infoMsg = false
        var errorMsg = false
        var msg = ""
        
        if (global.sharedObject.win) {
            if (property === "isOnline") {
                global.sharedObject.win.webContents.send('onlineCheckAPP', {isOnline: global.sharedObject.isOnline})
                
                if (global.sharedObject.isOnline) {
                    global.sharedObject.win.webContents.send('isOnline')
                    
                    infoMsg = true
                    msg = "Is online"
                }
                else {
                    errorMsg = true
                    msg = "Not online"
                }
            }
            else if (property === "coreRunning") {
                global.sharedObject.win.webContents.send('coreCheckAPP', {coreRunning: global.sharedObject.coreRunning})
                global.sharedObject.win.webContents.send('coreRunning')
                
                infoMsg = true
                msg = "Node client is running"
            }
            else if (property === "coreError") {
                global.sharedObject.win.webContents.send('coreCheckAPP', {coreError: global.sharedObject.coreError})
                global.sharedObject.win.webContents.send('coreError')
                
                errorMsg = true
                msg = "Node client not running"
            }
            else if (property === "rpcConnected") {
                global.sharedObject.win.webContents.send('rpcCheckAPP', {rpcConnected: global.sharedObject.rpcConnected})
                global.sharedObject.win.webContents.send('rpcConnected')
                
                infoMsg = true
                msg = "RPC connection made"
            }
            else if (property === "rpcError") {
                global.sharedObject.win.webContents.send('rpcCheckAPP', {rpcError: global.sharedObject.rpcError})
                global.sharedObject.win.webContents.send('rpcError')
                
                errorMsg = true
                msg = "RPC connection error"
                
            }
            else if (property === "coreSynced") {
                global.sharedObject.win.webContents.send('coreSyncCheckAPP', {coreSynced: global.sharedObject.coreSynced})
                global.sharedObject.win.webContents.send('coreSynced')
                
                infoMsg = true
                msg = "Node client synced"
            }
            else if (property === "coreSyncError") {
                global.sharedObject.win.webContents.send('coreSyncCheckAPP', {coreSyncError: global.sharedObject.coreSyncError})
                global.sharedObject.win.webContents.send('coreSyncError')
                
                errorMsg = true
                msg = "Node client sync error"
            }
            else if (property === "blockExplorerError") {
                global.sharedObject.win.webContents.send('blockExplorerErrorAPP', {blockExplorerError: global.sharedObject.blockExplorerError})
                
                errorMsg = true
                msg = "Block explorer error"
            }
            
            if (infoMsg)
                global.sharedObject.sysLogger.info(msg)
            else if (errorMsg)
                global.sharedObject.sysLogger.error(msg)
        }
    }, 0, true)
    
    // send a notice to renderers when availableProjects is updated
    watch(global.availableProjects, function(property, action, newValue, oldValue) {
        if (global.sharedObject.win)
            global.sharedObject.win.webContents.send('projectsReady')
    })
    
    global.referrer = ""
    global.apiCallbackInfo = new Map() // keeps track of API callback vars per function call
    
    // app config
    ipcMain.setMaxListeners(0) // set max listeners to unlimited
    
    loadProjects()
    loadInternalData()    
    
    // setup logging
    logFile = getCurrentDate()
    
    /* from: https://github.com/winstonjs/winston/issues/1243#issuecomment-411360908 */
    const formatErrorConverter = format(info =>
        info instanceof Error
            ? Object.assign({ level: info.level, message: info.message, stack: info.stack }, info)
            : info,
    )
    const formatErrorConverterInstance = formatErrorConverter();
    
    // system logger for info and error
    winston.loggers.add('sysLogger', {
        format: combine(timestamp(), prettyPrint(), formatErrorConverterInstance),
        transports: [
            new module.exports.JsonDBTransport({filename: path.join(sysLogsPath, logFile), level: 'info', label: 'system'})
        ],
        exitOnError: false
    })
    
    // unhandled exception logger
    winston.loggers.add('exceptionLogger', {
        format: combine(timestamp(), prettyPrint(), formatErrorConverterInstance),
        transports: [
            new module.exports.JsonDBTransport({filename: path.join(sysLogsPath, logFile+'_exceptions'), level: 'error', label: 'exception'})
        ],
        exitOnError: false
    })
    
    // user action logger
    winston.loggers.add('logger', {
        format: combine(timestamp(), prettyPrint()),
        transports: [
            new module.exports.JsonDBTransport({filename: path.join(userLogsPath, logFile), level: 'info', label: 'user'})
        ],
        exitOnError: false
    })
    
    global.sharedObject.sysLogger = winston.loggers.get('sysLogger')
    global.sharedObject.sysLogger.emitErrs = true
    global.sharedObject.exceptionLogger = winston.loggers.get('exceptionLogger')
    global.sharedObject.exceptionLogger.emitErrs = true
    global.sharedObject.logger = winston.loggers.get('logger')
    global.sharedObject.logger.emitErrs = true
    
    // catch unhandled exceptions
    unhandled({
        logger: function(err) {
            global.sharedObject.exceptionLogger.error(err.stack)
            
            // the "EPERM operation not permitted error" is fatal (https://github.com/sindresorhus/electron-store/issues/31)
            if (err.message.indexOf('EPERM') != -1)
                createDialog(null, global.sharedObject.win, "error", "SmartSweeper has encountered a fatal error. The app will now close.", true)
        },
        showDialog: true
    })
    
    //if (isDev)
        //global.sharedObject.logger.add(new transports.Console({format: format.simple()}))
}

// load the project db or create it if it doesn't exist
// saved in %APPDATA%/smart-sweeper on Win
// saved in $XDG_CONFIG_HOME/smart-sweeper or ~/.config/smart-sweeper on Linux
// saved in ~/Library/Application Support/smart-sweeper on Mac
function loadProjects() {
    db = new Store({name: "smart-sweeper"})
    global.availableProjects = db.get('projects')
    if (global.availableProjects === undefined) {
        db.set('projects', {index: 0, list: []})
        global.availableProjects = db.get('projects')
    }
}

// load the internal data or create it if it doesn't exist
// saved in %APPDATA%/smart-sweeper on Win
// saved in $XDG_CONFIG_HOME/smart-sweeper or ~/.config/smart-sweeper on Linux
// saved in ~/Library/Application Support/smart-sweeper on Mac
function loadInternalData() {
    try {
        savedAppData = new Store({name: "smart-sweeper-data"})
        global.savedAppData = savedAppData.get('data')
        if (global.savedAppData === undefined) {
            savedAppData.set('data', {
                availableBalanceTotal: 0,
                pendingFundsTotal: 0,
                pendingWalletsTotal: 0,
                confirmedFundsTotal: 0,
                confirmedWalletsTotal: 0,
                claimedFundsTotal: 0,
                claimedWalletsTotal: 0,
                sweptFundsTotal: 0,
                sweptWalletsTotal: 0
            })
            global.savedAppData = savedAppData.get('data')
        }
    }
    catch(err) {
        createDialog(null, global.sharedObject.win, "error", err, true)
    }
}

// some code from: https://github.com/trodi/electron-splashscreen
function createSplashScreen() {
    // set up splash screen
    const splashScreenConfig = {
        backgroundColor: '#FFF',
        width: 365,
        height: 365,
        frame: false,
        center: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            devTools: false,
            nodeIntegration: true,
        },
        show: false
    }
    
    splashScreen = new BrowserWindow(splashScreenConfig)
    splashScreen.loadURL(url.format({
        pathname: path.join(__dirname, 'app', 'utils', 'splash.html'),
        protocol: 'file',
        slashes: true
    }))
    splashScreen.on("ready-to-show", () => {
        //splashScreen.maximize()
        splashScreen.show()
    })
}

function closeSplashScreen() {
    if (splashScreen) {
        splashScreen.close()
        splashScreen = null
        global.sharedObject.win.maximize()
        global.sharedObject.win.show()
    }
}

// create the background window used to run async tasks
function createBgWindow() {
    const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize    
    const windowConfig = {
        title: "",
        width: 800,
        height: 700,
        center: true,
        //focusable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            devTools: true
        },
        show: false
    }

    // Create the browser window.`
    bgWin = new BrowserWindow(windowConfig)
    bgWin.loadURL(url.format({
        pathname: path.join(__dirname, 'background', 'background.html'),
        protocol: 'file',
        slashes: true
    }))
    bgWin.setMenu(null)

    bgWin.on("ready-to-show", () => {
        setTimeout(function() {
            closeSplashScreen()
            //bgWin.show()
        }, 12000)
    })
    
    bgWin.on('show', () => {
        //bgWin.openDevTools()
    })

    bgWin.on('closed', () => {        
        bgWin = null
    })
}

// create the main window
function createWindow() {
    const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize    
    const windowConfig = {
        title: "SmartSweeper",
        width: width, //1000,
        height: height, //600,
        center: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            devTools: true
        },
        show: false
    }
    
    // Create the browser window.
    global.sharedObject.win = new BrowserWindow(windowConfig)
    global.sharedObject.win.setMenu(null)

    // and load the index.html of the app.
    global.sharedObject.win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file',
        slashes: true
    }))
    
    global.sharedObject.win.on("ready-to-show", () => {
        
    })
    
    global.sharedObject.win.on('show', () => {
        if (global.sharedObject.win) {
            //global.sharedObject.win.webContents.openDevTools()
            global.sharedObject.win.webContents.send('projectsReady')
        }
    })

    // Emitted when the window is closed.
    global.sharedObject.win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        if (bgWin) {
            bgWin.close()
            bgWin = null
            global.sharedObject.win = null
        }
    })
}

// create a modal
function createModal(type, text) {
    var parent, title, width, height, pathname, resizable, minimizable, maximizable, alwaysOnTop, fullscreenable
    
    winBounds = global.sharedObject.win.getBounds()
    
    if (type === "edit") {
        title = "Edit Project '" + global.activeProject.name + "'"
        parent = global.sharedObject.win
        width = Math.ceil(winBounds.width - (winBounds.width*0.6))
        height = Math.ceil(winBounds.height - (winBounds.height*0.15))
        pathname = path.join(__dirname, 'app', 'utils', 'editModal.html')
        resizable = true
        minimizable = true
        maximizable = true
        alwaysOnTop = false
        fullscreenable = true
    }
    else if (type === "paperWallets") {
        title = "Paper Wallets for Project '" + global.activeProject.name + "'"
        parent = global.sharedObject.win
        width = 1000
        //width = Math.ceil(winBounds.width - (winBounds.width*0.52))
        height = winBounds.height
        pathname = path.join(__dirname, 'app', 'fund', 'paperWallet.html')
        resizable = true
        minimizable = true
        maximizable = true
        alwaysOnTop = false
        fullscreenable = true
    }
    else if (type === "fund") {
        title = "Fund Project '" + global.activeProject.name + "'"
        parent = global.sharedObject.win
        width = Math.ceil(winBounds.width - (winBounds.width*0.35))
        height = Math.ceil(winBounds.height - (winBounds.height*0.15))
        pathname = path.join(__dirname, 'app', 'fund', 'fundModal.html')
        resizable = true
        minimizable = true
        maximizable = true
        alwaysOnTop = false
        fullscreenable = true
    }
    
    if (modal)
        return;
    
    modal = new BrowserWindow({
        title: title,
        width: width,
        height: height,
        resizable: resizable,
        minimizable: minimizable,
        maximizable: maximizable,
        alwaysOnTop: alwaysOnTop,
        fullscreenable: fullscreenable,
        parent: parent,
        modal: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })
    
    modal.setMenu(null)
    
    modal.loadURL(url.format({
        pathname: pathname,
        protocol: 'file:',
        slashes: true
    }))
    
    modal.once('ready-to-show', () => {
        if (type === "paperWallets")
            modal.webContents.send('paperWalletsModal', {project: global.activeProject})
        
        modal.show()
    })
    
    modal.on('closed', () => {
        modal = null
    })
}

function createDialog(event, window, type, text, fatal = false) {
    var buttons
    
    console.log('dialog text: ', text)
    
    if (type === 'question')
        buttons = ['OK', 'Cancel']
    else if (type === 'info' || type === 'error')
        buttons = ['OK']
    
    dialog.showMessageBox(window, {
        type: type,
        buttons: buttons,
        title: text.title,
        message: text.body
    }, function(resp) {
        if (event != null) {
            if (resp == 0) {
                if (modal === undefined || modal == null)
                    event.sender.send('dialogYes')
                else
                    window.webContents.send('dialogYes')

            }
            else {
                if (modal === undefined || modal == null)
                    event.sender.send('dialogNo')
                else
                    window.webContents.send('dialogNo')
            }
        }
        
        console.log('fatal: ', fatal)
        
        if (fatal)
            app.quit()
    })
}

/* Generic API callback function. */
let apiCallback = function(resp, functionName, projectInfo) {
    var referrer = projectInfo.referrer
    var apiCallbackInfo = global.apiCallbackInfo.get(referrer)
    
    /*if (referrer === "getClaimedFundsInfo") {
        console.log('apiCallback referrer: ', referrer)
        console.log('apiCallbackInfo: ', apiCallbackInfo)
        console.log('projectInfo: ', projectInfo)
        console.log()
    }*/
    
    if (apiCallbackInfo !== undefined) {
        if (resp.type === "data") {            
            if (projectInfo.projectName) {
                var address = ""
                if (projectInfo.address)
                    address = ", wallet address: " + projectInfo.address
                
                global.sharedObject.sysLogger.info(referrer + ' - ' + functionName + ', project: ' + projectInfo.projectName + address)
            }
            else if (projectInfo.address)
                global.sharedObject.sysLogger.info(referrer + ' - ' + functionName + ', wallet address: ' + projectInfo.address)
            else if (projectInfo.projectID)
                global.sharedObject.sysLogger.info(referrer + ' - ' + functionName + ', project #' + projectInfo.projectID)
            else
                global.sharedObject.sysLogger.info(referrer + ' - ' + functionName)
            
            if (referrer === "getProjectAddressInfo") {
                console.log('projectInfo: ', projectInfo)
                //console.log('from ' + functionName)
                console.log(resp.msg)
                console.log()
            }

            if (functionName === "checkBalance") {
                global.sharedObject.blockExplorerError = false
                
                if (referrer === "checkProjectBalances") {
                    global.availableProjects.list[projectInfo.projectIndex].currentFunds = resp.msg
                    
                    if (resp.msg == 0)
                        global.availableProjects.list[projectInfo.projectIndex].zeroBalance = true
                        
                    db.set('projects', global.availableProjects)
                }
                else if (referrer === "getClaimedFundsInfo") {
                    if ((global.availableProjects.list[projectInfo.projectIndex].recvAddrs[projectInfo.addrIndex].txConfirmed == true) &&
                        !global.availableProjects.list[projectInfo.projectIndex].recvAddrs[projectInfo.addrIndex].swept && 
                        (resp.msg == 0)) {
                        global.availableProjects.list[projectInfo.projectIndex].recvAddrs[projectInfo.addrIndex].claimed = true
                        apiCallbackInfo.claimedFunds += projectInfo.addrAmt
                        apiCallbackInfo.claimedWallets++
                    }
                    else {
                        global.availableProjects.list[projectInfo.projectIndex].recvAddrs[projectInfo.addrIndex].claimed = false
                    }
                }
                else if (referrer === "getSweptFundsInfo") {
                    if (resp.msg == 0)
                        global.availableProjects.list[projectInfo.projectIndex].recvAddrs[projectInfo.addrIndex].swept = true
                }
            }
            else if (functionName === "checkTransaction") {
                if (referrer === "checkFundingTxids") {
                    var obj = {}
                    
                    resp.msg.vout.forEach(function(tx, key) {                        
                        if (tx.scriptPubKey.addresses.includes(projectInfo.address)) {
                            if (resp.msg.confirmations >= 6) {
                                obj[projectInfo.txid] = {confirmed: true, confirmations: resp.msg.confirmations}
                                apiCallbackInfo.balance += tx.value
                            }
                            else {
                                obj[projectInfo.txid] = {confirmed: false, confirmations: resp.msg.confirmations}
                            }

                            apiCallbackInfo.txInfo.push(obj)
                        }
                    })
                }
                else if (referrer === "checkAvailProjectBalances") {
                    if (resp.msg.confirmations >= 6 && !projectInfo.fundsSent) {
                        resp.msg.vout.forEach(function(tx, key) {
                            if (tx.scriptPubKey.addresses.includes(projectInfo.address)) {
                                apiCallbackInfo.total += tx.value
                            }
                        })
                    } 
                }
                else if (referrer === "getProjectTxStatus") {
                    // check the total num of confirmed tx for each project against the total number of txids
                    if (resp.msg == global.availableProjects.list[projectInfo.projectIndex].txid.length)
                        global.availableProjects.list[projectInfo.projectIndex].txConfirmed = true
                    else
                        global.availableProjects.list[projectInfo.projectIndex].txConfirmed = false
                }
                else if (referrer === "getSweptTxStatus") {
                    if (resp.msg.confirmations >= 6)
                        global.availableProjects.list[projectInfo.projectIndex].sweepTxConfirmed = true
                }
                else if (referrer === "getWalletTxStatus") {
                    //console.log('resp.msg: ', resp.msg)
                    
                    global.availableProjects.list[projectInfo.projectIndex].recvAddrs[projectInfo.addrIndex].confirmations = resp.msg.confirmations

                    if (resp.msg.confirmations < 6) {
                        apiCallbackInfo.pendingFunds += projectInfo.addrAmt
                        apiCallbackInfo.pendingWallets++
                    }
                    else {
                        global.availableProjects.list[projectInfo.projectIndex].recvAddrs[projectInfo.addrIndex].txConfirmed = true
                        apiCallbackInfo.confirmedFunds += projectInfo.addrAmt
                        apiCallbackInfo.confirmedWallets++
                    }
                }
            }
            else if (functionName === "getAddressInfo") {
                if (referrer === "getProjectAddressInfo") {
                    apiCallbackInfo.balance = resp.msg.balance
                    apiCallbackInfo.txs = resp.msg.transactions
                }
            }
            else if (functionName === "sendFunds") {
                if (referrer === "fundProject") {
                    apiCallbackInfo.validTx = true
                    apiCallbackInfo.msg = "Success. Project information updated."
                }
                else if ((referrer === "sendPromotionalFunds")) {
                    global.availableProjects.list[projectInfo.projectIndex].recvAddrs.forEach(function(address, key) {
                        address.sentTxid = resp.msg
                        address.txConfirmed = false
                        address.confirmations = 0
                    });
                }
            }
            else if (functionName === "sweepFunds") {
                global.availableProjects.list[projectInfo.projectIndex].sweepTxid = resp.msg
                global.availableProjects.list[projectInfo.projectIndex].sweepTxConfirmed = false
                global.availableProjects.list[projectInfo.projectIndex].fundsSwept = true
                db.set('projects', global.availableProjects)
            }    


            // once all of the projects/promotional wallets have been processed, send data back to the initiator
            apiCallbackInfo.apiCallbackCounter++
            var apiCallbackCounter = apiCallbackInfo.apiCallbackCounter

            if (functionName === "checkBalance") {
                if ((referrer === "getClaimedFundsInfo") && (apiCallbackCounter == apiCallbackInfo.totalAddrs)) {
                    // store the claimed funds and claimed wallets total in a config file
                    global.savedAppData.claimedFundsTotal = apiCallbackInfo.claimedFunds
                    global.savedAppData.claimedWalletsTotal = apiCallbackInfo.claimedWallets
                    savedAppData.set('config', global.savedAppData)

                    // calculate the number of claimed wallets per project
                    var claimed
                    global.availableProjects.list.forEach(function(project, projectKey) {
                        claimed = 0

                        if (project.fundsSent && !project.fundsSwept) {
                            project.recvAddrs.forEach(function(address, addressKey) {
                                if (address.claimed)
                                    claimed++
                            })
                        }
                        
                        project.claimedAddr = claimed
                        if (project.claimedAddr == project.recvAddrs.length)
                            project.allClaimed = true
                        else
                            project.allClaimed = false
                    })

                    db.set('projects', global.availableProjects)
                    
                    if (global.sharedObject.win) {
                        global.sharedObject.win.webContents.send('projectsReady')
                        global.sharedObject.win.webContents.send('claimedFundsInfo', {claimedFunds: apiCallbackInfo.claimedFunds, claimedWallets: apiCallbackInfo.claimedWallets})
                    }
                    
                    global.apiCallbackInfo.delete(referrer)
                }
                else if (referrer === "getSweptFundsInfo") {
                    var totalSweptFunds = 0
                    var projectSweptFunds
                    var sweptWalletsCount = 0

                    global.availableProjects.list.forEach(function(project, projectKey) {
                        projectSweptFunds = 0
                        
                        if (project.fundsSwept) {
                            project.recvAddrs.forEach(function(address, addrKey) {
                                if (address.swept) {
                                    projectSweptFunds += project.addrAmt
                                    sweptWalletsCount++
                                }
                            })
                            
                            var txFee = getTxFee(sweptWalletsCount)
                            totalSweptFunds = totalSweptFunds + (projectSweptFunds - txFee)
                        }
                    });

                    db.set('projects', global.availableProjects)
                    
                    if (global.sharedObject.win) {
                        global.sharedObject.win.webContents.send('projectsReady')
                        global.sharedObject.win.webContents.send('sweptFundsInfo', {sweptFunds: totalSweptFunds, sweptWalletsCount: sweptWalletsCount})
                    }
                    
                    global.apiCallbackInfo.delete(referrer)
                }
            }
            else if (functionName === "checkTransaction") {
                if (referrer === "checkFundingTxids" && (apiCallbackCounter == apiCallbackInfo.txCount)) {
                    var confirmedCounter = 0
                    var txids = []

                    apiCallbackInfo.txInfo.forEach(function(tx, key) {
                        txids.push(tx)

                        if (Object.values(tx)[0])
                           confirmedCounter++
                    })
                    
                    global.availableProjects.list[projectInfo.projectIndex].txid = txids

                    if (confirmedCounter == apiCallbackInfo.txInfo.length) {
                        global.availableProjects.list[projectInfo.projectIndex].originalFunds = apiCallbackInfo.balance
                        global.availableProjects.list[projectInfo.projectIndex].txConfirmed = true
                    }
                    else {
                        global.availableProjects.list[projectInfo.projectIndex].txConfirmed = false
                    }

                    db.set('projects', global.availableProjects)
                    
                    if (global.sharedObject.win) {
                        global.sharedObject.win.webContents.send('projectsReady')
                        
                        if (modal) {
                            modal.webContents.send('fundingTxidsChecked', {msgType: 'data', confirmed: global.availableProjects.list[projectInfo.projectIndex].txConfirmed, txInfo: apiCallbackInfo.txInfo, balance: apiCallbackInfo.balance})
                        }
                        else {
                            global.sharedObject.win.webContents.send('projectsReady')
                        }
                    }
                    
                    global.apiCallbackInfo.delete(referrer)
                }
                else if ((referrer === "checkAvailProjectBalances") && (apiCallbackCounter == apiCallbackInfo.totalTxs)) {
                    global.taskStatus.set('checkAvailProjectBalances', {status: true, error: false})
                    global.savedAppData.availableBalanceTotal = apiCallbackInfo.total
                    savedAppData.set('config', global.savedAppData)
                    db.set('projects', global.availableProjects)
                    
                    if (global.sharedObject.win) {
                        global.sharedObject.win.webContents.send('projectsReady')
                        global.sharedObject.win.webContents.send('balancesChecked', {availableBalance: apiCallbackInfo.total})
                    }
                    
                    global.apiCallbackInfo.delete(referrer)
                }
                else if ((referrer === "getProjectTxStatus") && (apiCallbackCounter == apiCallbackInfo.totalProjects)) {
                    db.set('projects', global.availableProjects)
                    
                    if (global.sharedObject.win)
                        global.sharedObject.win.webContents.send('projectsReady')
                    
                    global.apiCallbackInfo.delete(referrer)
                }
                else if (referrer === "getSweptTxStatus" && (apiCallbackCounter == apiCallbackInfo.totalSweptProjects)) {
                    db.set('projects', global.availableProjects)
                    
                    if (global.sharedObject.win)
                        global.sharedObject.win.webContents.send('projectsReady')
                    
                    global.apiCallbackInfo.delete(referrer)
                }
                else if ((referrer === "getWalletTxStatus") && (apiCallbackCounter == apiCallbackInfo.totalAddrs)) {
                    global.savedAppData.pendingFundsTotal = apiCallbackInfo.pendingFunds
                    global.savedAppData.pendingWalletsTotal = apiCallbackInfo.pendingWallets
                    global.savedAppData.confirmedFundsTotal = apiCallbackInfo.confirmedFunds
                    global.savedAppData.confirmedWalletsTotal = apiCallbackInfo.confirmedWallets
                    savedAppData.set('config', global.savedAppData)
                    db.set('projects', global.availableProjects)

                    if (global.sharedObject.win) {
                        global.sharedObject.win.webContents.send('allTxInfo', {pendingFunds: apiCallbackInfo.pendingFunds, pendingWallets: apiCallbackInfo.pendingWallets, confirmedFunds: apiCallbackInfo.confirmedFunds, confirmedWallets: apiCallbackInfo.confirmedWallets})
                    }
                    
                    global.apiCallbackInfo.delete(referrer)
                }
            }
            else if (functionName === "getAddressInfo") {
                if (referrer === "getProjectAddressInfo") {
                    var existingTxids = []
                    
                    if (global.availableProjects.list[projectInfo.projectIndex].txid === undefined) {
                        // create the txid array if it doesn't already exist
                        global.availableProjects.list[projectInfo.projectIndex].txid = []
                    }
                    else {
                        // create an array of existing txids
                        global.availableProjects.list[projectInfo.projectIndex].txid.forEach(function(txid, key) {
                            existingTxids.push(Object.keys(txid)[0])
                        })
                    }
                    
                    var obj = {}                    
                    apiCallbackInfo.txs.forEach(function(txid, key) {
                        if (existingTxids.includes(txid) == false) {
                            obj[txid] = {confirmed: false, confirmations: 0}
                            global.availableProjects.list[projectInfo.projectIndex].txid.push(obj)
                        }
                    })
                    
                    db.set('projects', global.availableProjects)
                    
                    if (global.sharedObject.win) {
                        modal.webContents.send('gotAddressInfo', {msgType: 'data', balance: apiCallbackInfo.balance, txs: apiCallbackInfo.txs})
                    }
                    
                    global.apiCallbackInfo.delete(referrer)
                }
            }
            else if (functionName === "sendFunds") {
                if ((referrer === "fundProject")) {
                    global.availableProjects.list[projectInfo.projectIndex].projectFunded = true
                    global.availableProjects.list[projectInfo.projectIndex].zeroBalance = false
                    global.availableProjects.list[projectInfo.projectIndex].txConfirmed = false
                    global.apiCallbackInfo.delete(referrer)
                    db.set('projects', global.availableProjects)
                    
                    if (modal)
                        modal.webContents.send('projectFunded', {validTx: apiCallbackInfo.validTx, msg: apiCallbackInfo.msg})
                    
                    global.sharedObject.logger.info('Project "' + global.activeProject.name + '" was funded.')
                    refreshLogFile()
                }
                else if ((referrer === "sendPromotionalFunds")) {
                    global.sharedObject.logger.info('Funds were sent to promotional wallets for project "' + projectInfo.projectName + '".')
                    refreshLogFile()

                    global.availableProjects.list[projectInfo.projectIndex].fundsSent = true
                    db.set('projects', global.availableProjects)
                    
                    if (global.sharedObject.win) {
                        global.sharedObject.win.webContents.send('projectsReady')
                        global.sharedObject.win.webContents.send('promotionalFundsSent', {msgType: 'data', msg: 'Funds were sent to promotional wallets for project "' + projectInfo.projectName + '".'})
                    }
                    
                    global.apiCallbackInfo.delete(referrer)
                }
            }
            else if ((functionName === "sweepFunds") && (apiCallbackCounter == apiCallbackInfo.totalProjects)) {                
                var projectNames = ""
                apiCallbackInfo.projectNames.forEach(function(name, index) {
                    if (apiCallbackInfo.totalProjects == 1)
                        projectNames = name
                    else if (apiCallbackInfo.totalProjects == 2) {
                        if (index == 0)
                            projectNames = name
                        else
                            projectNames = projectNames + " and " + name
                    }
                    else {
                        if (index < apiCallbackInfo.projectNames.length-1)
                            projectNames = projectNames + ", " + name
                        else
                            projectNames = projectNames + ", and " + name
                    }
                })
                
                global.taskStatus.set('sweepFunds', {status: true, error: false})                
                
                global.sharedObject.logger.info('Funds were swept for project(s) "' + projectNames + '".')
                refreshLogFile()
                
                if (global.sharedObject.win) {
                    global.sharedObject.win.webContents.send('fundsSwept', {msgType: 'data', msg: 'Funds were swept for project(s) "' + projectNames + '".'})
                }
            }
        }
        else if (resp.type === "error") {
            console.log('error msg: ', resp.msg)
            
            // transaction's not in the blockchain yet
            if (functionName === "checkTransaction" && resp.msg === "Invalid transaction id.") {
                return
            }

            if (projectInfo.projectName) {
                global.sharedObject.sysLogger.error(referrer + ' - ' + functionName + ': ' + resp.msg + ', project: ' + projectInfo.projectName)

                /*if (referrer === "fundProject" && global.sharedObject.win) {
                    apiCallbackInfo.msg = resp.msg
                    modal.webContents.send('fundingTxidChecked', {msgType: 'error', msg: apiCallbackInfo.msg})
                }*/
                
                if ((referrer === "checkAvailProjectBalances") || (referrer === "sweepFunds")) {
                    var obj = global.taskStatus.get(referrer)
                    obj.error = true
                    global.taskStatus.set(referrer, obj)
                }

                if (functionName === "checkBalance") {
                    global.sharedObject.blockExplorerError = true
                }

                if (referrer === "sendPromotionalFunds" && global.sharedObject.win) {
                    global.sharedObject.win.webContents.send('promotionalFundsSent', {msgType: 'error', msg: 'Promotional funds could not be sent for project "' + projectInfo.projectName + '".'})
                }
                else if (referrer === "fundsSwept" && global.sharedObject.win) {
                    global.sharedObject.win.webContents.send('fundsSwept', {msgType: 'error', msg: 'Funds could not be swept for project "' + projectInfo.projectName + '".'}) 
                }
            }
            else if (projectInfo.projectID) {
                global.sharedObject.sysLogger.info(referrer + ' - ' + functionName + ', project #' + projectInfo.projectID)
            }
            else {
                global.sharedObject.sysLogger.error(referrer + ' - ' + functionName + ': ' + resp.msg)
            }
        }
    }
}

// automatically sweep project funds if sweep date has expired - NOT USED
function autoSweepFunds() {
}

// create the receiver addresses for a project
function createRecvAddresses(project) {
    project.recvAddrs = []
    var addressPair
    
    for (var i=0; i<project.numAddr; i++) {
        addressPair = smartcashapi.generateAddress()
        addressPair.claimed = false
        project.recvAddrs.push(addressPair)
    }
    project.claimedAddr = 0
    
    var txFee = getTxFee(project.recvAddrs.length)    
    if (project.projectFunded)
        project.addrAmt = (project.originalFunds - txFee) / project.numAddr
    
    var index = getDbIndex(project.id)
    global.availableProjects.list[index] = project
    global.activeProject = project
    db.set('projects', global.availableProjects)
    
    global.sharedObject.logger.info('Receiver addresses for project "' + project.name + '" were created.')
    refreshLogFile()
}

// get the current date and format it as YYYYMMDD
function getCurrentDate() {
    var today = new Date()
    var year = today.getFullYear()
    var month = today.getMonth() + 1
    var day = today.getDate()
    
    if (month < 10)
        month = "0" + String(month)
    else
        month = String(month)
    
    if (day < 10)
        day = "0" + String(day)
    else
        day = String(day)
    
    return String(year) + month + day
}

// return the index of a project in the database
function getDbIndex(projectID) {
    var arrayIndex
    
    global.availableProjects.list.forEach(function(project, index) {
        if (project.id == projectID)
            arrayIndex = index
    })
    
    return arrayIndex
}

// find the newest user log or system log file
function getNewestLogFile(type, subtype = "") {
    var logPath
    
    if (type === "user")
        logPath = path.join(app.getPath('userData'), userLogsPath) + path.sep
    else if (type === "system")
        logPath = path.join(app.getPath('userData'), sysLogsPath) + path.sep
    
    var files = fs.readdirSync(logPath)
    if (files.length == 0) {
        global.availableLog = null
        event.sender.send('logReady')
        return
    }
    
    var stats = fs.statSync(logPath + files[0])
    var mostRecent = {file: files[0], lastModified: stats.mtime}
    
    var subtypeFile = ""
    files.forEach(function(file, index) {
        if (subtype === "" && file.indexOf('_') == -1)
            subtypeFile = file
        else if (file.indexOf(subtype) != -1)
            subtypeFile = file
        
        if (subtypeFile !== "") {
            stats = fs.statSync(logPath + subtypeFile)        
            if (stats.mtime > mostRecent.lastModified)
                mostRecent = {file: subtypeFile, lastModified: stats.mtime}
            
            subtypeFile = ""
        }
    })
    
    return mostRecent
}

/* Given a certain number of wallets, get the SmartCash transaction fee. */
function getTxFee(numWallets) {
    // get the appropriate tx fee based on the total number of wallets
    var txTiers = Object.keys(global.sharedObject.txFeeTiers)
    var tierKey
    var numAddr
    
    txTiers.forEach(function(tier, key) {
        numAddr = tier.split('-')
        
        if ((numWallets >= parseInt(numAddr[0])) && (numWallets <= parseInt(numAddr[1])))
            tierKey = tier
    })
    
    return global.sharedObject.txFeeTiers[tierKey]
}

// load the most recent log file
function loadLog() {
    var mostRecent = getNewestLogFile('user')
    var mostRecentFile
    mostRecentFile = path.join(userLogsPath, path.parse(mostRecent.file).name)
    
    var logDB = new Store({name: mostRecentFile})
    return {content: logDB.get('log'), date: mostRecent.lastModified}
}

// create a project
function newProject(event, project) {
    var newProject = project
    newProject.id = global.availableProjects.index + 1
    newProject.originalFunds = 0
    newProject.addressPair = {}
    
    var addressPair = smartcashapi.generateAddress()
    newProject.addressPair.publicKey = addressPair.publicKey
    newProject.addressPair.privateKey = addressPair.privateKey
    
    if (newProject.expDate == null) newProject.expDate = ""
    if (newProject.sweepDate == null) newProject.sweepDate = ""
    
    loadProjects()
    global.availableProjects.index = global.availableProjects.index + 1
    global.availableProjects.list.push(newProject)
    db.set('projects', global.availableProjects)
    
    global.sharedObject.logger.info('Project "' + newProject.name + '" was created.')
    refreshLogFile()
    event.sender.send('newProjectAdded')
    
    if (global.sharedObject.win)
        global.sharedObject.win.webContents.send('projectsReady')
}

// refresh the log currently loaded in the app
function refreshLogFile() {
    try {
        var stats = fs.statSync(path.join(app.getPath('userData'), userLogsPath, logFile+'.json'))
        
        var logDB = new Store({name: getCurrentDate()})
        var log = logDB.get('log')
        global.availableLog = {date: stats.mtime, content: log}

        if (global.sharedObject.win)
            global.sharedObject.win.webContents.send('logReady')
    }
    catch(err) {
        console.log(err)
    }
}

// set the active project based on a project ID
function setActiveProject(projectID) {
    var index = getDbIndex(projectID)
    global.activeProject = global.availableProjects[index]
}


app.on('will-finish-launching', () => {
    // app updater
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createSplashScreen()
    appInit()    
    createBgWindow()
    createWindow()
    
    // extras for dev mode
    if (isDev) {
        const elemon = require('elemon')
        elemon({
            app: app,
            mainFile: 'index.js',
            bws: [
              {bw: global.sharedObject.win, res: []}
            ]
        })
    }
})

// quit when all windows are closed.
app.on('window-all-closed', () => {
    // delete the user and system log files if they're empty
    var mostRecent = getNewestLogFile('user')
    var exitLogFile = path.join(userLogsPath, path.parse(mostRecent.file).name)
    var logDB = new Store({name: exitLogFile})

    if (logDB.get('log').length == 0) {
        fs.unlink(path.join(app.getPath('userData'), exitLogFile+'.json'), (err) => {
            if (err) throw err;
        })
    }

    mostRecent = getNewestLogFile('system')
    exitLogFile = path.join(sysLogsPath, path.parse(mostRecent.file).name)
    logDB = new Store({name: exitLogFile})

    if (logDB.get('log').length == 0) {
        fs.unlink(path.join(app.getPath('userData'), exitLogFile+'.json'), (err) => {
            if (err) throw err;
        })
    }
    
    mostRecent = getNewestLogFile('system', 'exceptions')
    exitLogFile = path.join(sysLogsPath, path.parse(mostRecent.file).name)
    logDB = new Store({name: exitLogFile})

    if (logDB.get('log').length == 0) {
        fs.unlink(path.join(app.getPath('userData'), exitLogFile+'.json'), (err) => {
            if (err) throw err;
        })
    }
    
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin')
        app.quit()
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (global.sharedObject.win === null) {
        createWindow()
        global.sharedObject.win.maximize()
    }
})


// check the available funded balances of all projects using transactions
ipcMain.on('checkAvailProjectBalances', (event, args) => {
    global.taskStatus.set('checkAvailProjectBalances', {status: false, error: false})
    
    //console.log('checkAvailProjectBalances: ')
    var totalTxs = 0
    
    if (global.availableProjects === undefined)
        loadProjects()
    
    global.availableProjects.list.forEach(function(project, projectKey) {
        if (project.projectFunded)
            totalTxs += project.txid.length
    })
    
    if (totalTxs > 0) {
        global.apiCallbackInfo.set('checkAvailProjectBalances', {
            apiCallbackCounter: 0,
            totalTxs: totalTxs,
            total: 0
        })

        global.availableProjects.list.forEach(function(project, projectKey) {
            if (project.projectFunded) {
                smartcashapi.checkTransaction({referrer: "checkAvailProjectBalances", projectName: project.name, projectIndex: projectKey, fundsSent: project.fundsSent, address: project.addressPair.publicKey, txid: project.txid}, apiCallback)
            }
        })
    }
    else {
        if (global.sharedObject.win)
            global.sharedObject.win.webContents.send('balancesChecked', {availableBalance: 0})
    }
})

// check the txid to get project funding info
ipcMain.on('checkFundingTxids', (event, args) => {
    //console.log('checkFundingTxids')
    //console.log(args)
    
    global.apiCallbackInfo.set('checkFundingTxids', {
        apiCallbackCounter: 0,
        txCount: args.activeTxs.length,
        txInfo: [],
        balance: 0
    })
    
    loadProjects()
    var index = getDbIndex(args.projectID)
    args.activeTxs.forEach(function(tx, key) {
        smartcashapi.checkTransaction({referrer: "checkFundingTxids", projectID: args.projectID, projectName: args.projectName, projectIndex: index, address: args.address, txid: tx}, apiCallback)
    })
})

// check the balances of all projects using checkBalance
ipcMain.on('checkProjectBalances', (event, args) => {
    loadProjects()
    
    global.apiCallbackInfo.set('checkProjectBalances', {
        apiCallbackCounter: 0
    })

    global.availableProjects.list.forEach(function(project, projectKey) {
        if (project.projectFunded) {
            smartcashapi.checkBalance({referrer: "checkProjectBalances", projectName: project.name, address: project.addressPair.publicKey, projectIndex: projectKey}, apiCallback)
        }
    })
})

// create paper wallets
ipcMain.on('createPaperWallets', (event, args) => {
    var index = getDbIndex(args.projectID)
    global.activeProject = global.availableProjects.list[index]
    modalType = "paperWallets"
    createModal('paperWallets')
})

// create the receiver addresses for a project
ipcMain.on('createRecvAddresses', (event, args) => {  
    loadProjects()
    
    if (args.newProjectFlag) {
        newProject(event, args.project)
        
        var index = getDbIndex(args.project.id)
        global.activeProject = global.availableProjects.list[index]
    }
    
    createRecvAddresses(args.project)
    
    if (global.sharedObject.win) {
        event.sender.send('addressesCreated')
        global.sharedObject.win.webContents.send('projectsReady')
    }
})

// delete a project
ipcMain.on('deleteProject', (event, args) => {
    loadProjects()
    var index = getDbIndex(args.id)
    var name = global.availableProjects.list[index].name
    global.availableProjects.list.splice(index, 1)
    db.set('projects', global.availableProjects)
    global.sharedObject.logger.info('Project "' + name + '" was deleted.')
    refreshLogFile()
    
    if (global.sharedObject.win)
        global.sharedObject.win.webContents.send('projectsReady')
})


// load a modal to edit a project
ipcMain.on('editProject', (event, args) => {
    modalType = "edit"
    global.activeProject = args.project
    createModal('edit')
})

// exit the app
ipcMain.on('exitApp', (event, args) => {
    app.exit()
})

// send funds to a project -- NOT USED
ipcMain.on('fundProject', (event, args) => {
    global.apiCallbackInfo.set('fundProject', {
        apiCallbackCounter: 0
    })
    
    console.log('fundProject args: ', args);
    args.referrer = "fundProject"    
    smartcashapi.sendFunds(args, apiCallback)
})

// check the txid to get project funding info
ipcMain.on('getProjectAddressInfo', (event, args) => {
    global.apiCallbackInfo.set('getProjectAddressInfo', {
        apiCallbackCounter: 0
    })
    
    loadProjects()
    var index = getDbIndex(args.projectID)    
    smartcashapi.getAddressInfo({referrer: "getProjectAddressInfo", projectID: args.projectID, projectName: args.projectName, projectIndex: index, address: args.address}, apiCallback);
})

// get the status of one or all project funding transactions
ipcMain.on('getProjectTxStatus', (event, args) => {
    //console.log('in getProjectTxStatus')
    
    var totalProjects = 0

    loadProjects()
    global.availableProjects.list.forEach(function(project, projectKey) {
        if (project.projectFunded && !project.txConfirmed)
            totalProjects++
    })

    if (totalProjects > 0) {
        global.apiCallbackInfo.set('getProjectTxStatus', {
            apiCallbackCounter: 0,
            totalProjects: totalProjects
        })

        global.availableProjects.list.forEach(function(project, projectKey) {
            if (project.projectFunded && !project.txConfirmed) {                
                smartcashapi.checkTransaction({referrer: "getProjectTxStatus", projectName: project.name, projectIndex: projectKey, txid: project.txid}, apiCallback)
            }
        })
    }
})

// get app data saved by the app (dashboard stats)
ipcMain.on('getSavedAppData', (event, args) => {    
    if (global.sharedObject.win)
        global.sharedObject.win.webContents.send('savedAppData', {savedAppData: global.savedAppData})
})

// get information about funds that have been swept
ipcMain.on('getSweptFundsInfo', (event, args) => {
    //console.log('in getSweptFundsInfo')
    var totalAddrs = 0
    
    if (global.availableProjects === undefined)
        loadProjects()
    
    global.availableProjects.list.forEach(function(project, projectKey) {
        if (project.fundsSwept) {
            project.recvAddrs.forEach(function(address, addrKey) {
                if (!address.claimed)
                    totalAddrs++
            })
        }
    })
    
    if (totalAddrs > 0) {
        global.apiCallbackInfo.set('getSweptFundsInfo', {
            apiCallbackCounter: 0,
            totalAddrs: totalAddrs,
            totalWalletsSwept: 0
        })
        
        global.availableProjects.list.forEach(function(project, projectKey) {
            if (project.fundsSwept) {
                project.recvAddrs.forEach(function(address, addrKey) {
                    if (!address.claimed) {
                        smartcashapi.checkBalance({referrer: "getSweptFundsInfo", projectName: project.name, address: address.publicKey, projectIndex: projectKey, addrIndex: addrKey}, apiCallback)
                    }
                })
            }
        })
    }
})

// get pending/confirmed status for all sweep transactions
ipcMain.on('getSweptTxStatus', (event, args) => {
    var index
    var totalSweptProjects = 0
    
    loadProjects()
    global.availableProjects.list.forEach(function(project, projectKey) {
        if (project.fundsSwept)
            totalSweptProjects++
    })
    
    global.apiCallbackInfo.set('getSweptTxStatus', {
        apiCallbackCounter: 0,
        totalSweptProjects: totalSweptProjects
    })
    
    global.availableProjects.list.forEach(function(project, projectKey) {
        if (project.fundsSwept) {
            index = getDbIndex(project.id)
            smartcashapi.checkTransaction({referrer: "getSweptTxStatus", projectName: project.name, projectIndex: index, txid: project.sweepTxid}, apiCallback)
        }
    })
})

// get pending/confirmed status for all promotional wallet transactions
ipcMain.on('getWalletTxStatus', (event, args) => {
    //console.log('in getWalletTxStatus')
    var totalAddrs = 0
    
    if (global.availableProjects === undefined)
        loadProjects()
    
    global.availableProjects.list.forEach(function(project, projectKey) {
        if (project.fundsSent)
            totalAddrs += project.numAddr
    })
    
    if (totalAddrs > 0) {
        global.apiCallbackInfo.set('getWalletTxStatus', {
            apiCallbackCounter: 0,
            pendingWallets: 0,
            pendingFunds: 0,
            confirmedWallets: 0,
            confirmedFunds: 0,
            totalAddrs: totalAddrs
        })
        
        global.availableProjects.list.forEach(function(project, projectKey) {
            if (project.fundsSent) {
                project.recvAddrs.forEach(function(address, addrKey) {
                    if (project.fundsSent) {
                        smartcashapi.checkTransaction({referrer: "getWalletTxStatus", projectName: project.name, projectIndex: projectKey, addrIndex: addrKey, txid: address.sentTxid, addrAmt: project.addrAmt}, apiCallback)
                    }
                })
            }
        })
    }
})

// get the total amount of gift funds that have been claimed
ipcMain.on('getClaimedFundsInfo', (event, args) => {
    //console.log('in getClaimedFundsInfo')
    //console.log(args)
    
    var index
    var project
    var totalAddrs = 0
    
    if (global.availableProjects === undefined)
        loadProjects()
    
    if (args === undefined) {
        global.availableProjects.list.forEach(function(project, projectKey) {
            if (project.fundsSent) {
                project.recvAddrs.forEach(function(address, addrKey) {
                    if (!address.claimed) totalAddrs++
                })
            }
        })
    }
    else {
        index = getDbIndex(args.projectID)
        project  = global.availableProjects.list[index]
    
        if (project.fundsSent) {
            project.recvAddrs.forEach(function(address, addrKey) {
                if (!address.claimed) totalAddrs++
            })
        }
    }
    
    if (totalAddrs > 0) {
        global.apiCallbackInfo.set('getClaimedFundsInfo', {
            apiCallbackCounter: 0,
            totalAddrs: totalAddrs,
            claimedFunds: 0,
            claimedWallets: 0
        })

        if (args === undefined) {
            // get the claimed amount for all wallets for all projects
            global.availableProjects.list.forEach(function(project, projectKey) {
                if (project.fundsSent) {
                    project.recvAddrs.forEach(function(address, addrKey) {
                        if (!address.claimed) {
                            smartcashapi.checkBalance({referrer: "getClaimedFundsInfo", addrIndex: addrKey, address: address.publicKey, addrAmt: project.addrAmt, projectIndex: projectKey}, apiCallback)
                        }
                        else {
                            global.apiCallbackInfo.get('getClaimedFundsInfo').claimedFunds += project.addrAmt
                            global.apiCallbackInfo.get('getClaimedFundsInfo').claimedWallets++
                        }
                    })
                }
            })
        }
        else {
            // get the claimed amount for all wallets for one project
            if (project.fundsSent) {
                project.recvAddrs.forEach(function(address, addrKey) {
                    if (!address.claimed) {
                        smartcashapi.checkBalance({referrer: "getClaimedFundsInfo", addrIndex: addrKey, address: address.publicKey, projectIndex: index, addrAmt: project.addrAmt, projectID: args.projectID}, apiCallback)
                    }
                    else {
                        global.apiCallbackInfo.get('getClaimedFundsInfo').claimedFunds += project.addrAmt
                        global.apiCallbackInfo.get('getClaimedFundsInfo').claimedWallets++
                    }
                })
            }
        }
    }
})

// load the most recent log file
ipcMain.on('loadLog', (event, args) => {
    var log = loadLog()
    global.availableLog = {date: log.date, content: log.content}
    event.sender.send('logReady')
})

// modal "cancel"
ipcMain.on('modalNo', (event, args) => {
    global.activeProject = null
    modal.close()
    
    if (global.sharedObject.win)
        global.sharedObject.win.webContents.send('modalNo')
})

// create a project
ipcMain.on('newProject', (event, args) => {
    newProject(event, args.newProject)
})

// open the log folder
ipcMain.on('openLogFolder', (event, args) => {
    shell.showItemInFolder(path.join(app.getPath('userData'), userLogsPath, logFile + '.json'))
})

// user confirmation that the project has been fully funded
ipcMain.on('projectFullyFunded', (event, args) => {
    loadProjects()
    var index = getDbIndex(global.activeProject.id)
    global.availableProjects.list[index].projectFunded = true
    global.availableProjects.list[index].zeroBalance = false
    db.set('projects', global.availableProjects)
    
    if (global.sharedObject.win)
        global.sharedObject.win.webContents.send('projectsReady')
    
    global.sharedObject.logger.info('Project "' + global.activeProject.name + '" was marked "fully funded".')
    refreshLogFile()
})

// manually refresh the current log file
ipcMain.on('refreshLog', (event, args) => {
    refreshLogFile()
})

// send funds to receiver addresses
ipcMain.on('sendPromotionalFunds', (event, args) => {
    var numWallets = args.wallets.length
    var txFee = getTxFee(numWallets)
    
    // calculate and save the amount per address
    var totalAmtToSend = args.originalFunds - txFee
    var amtPerWallet = totalAmtToSend / numWallets
    
    console.log('args.originalFunds: ', args.originalFunds)
    console.log('txFee: ', txFee)
    console.log('args.wallets.length: ', args.wallets.length)
    console.log('amtPerWallet: ', amtPerWallet)
    
    loadProjects()
    var index = getDbIndex(args.projectID)
    global.availableProjects.list[index].addrAmt = amtPerWallet
    db.set('projects', global.availableProjects)
    
    var toAddr = []
    args.wallets.forEach(function(wallet, key) {
        toAddr.push(wallet.publicKey)
    })
    console.log('toAddr: ', toAddr)
    
    global.apiCallbackInfo.set('sendPromotionalFunds', {
        apiCallbackCounter: 0
    })
    
    //smartcashapi.sendFunds({referrer: "sendPromotionalFunds", projectIndex: index, projectName: global.availableProjects.list[index].name, total: totalAmtToSend, amount: amtPerWallet, fromAddr: args.fromAddr, fromPK: args.fromPK, toAddr: toAddr}, apiCallback);
})

// set which function opened a modal/dialog
ipcMain.on('setReferrer', (event, args) => {
    global.referrer = args.referrer
})

// load a confirmation dialog
ipcMain.on('showConfirmationDialog', (event, text) => {    
    if (modal === undefined || modal == null)
        createDialog(event, global.sharedObject.win, 'question', text)
    else
        createDialog(event, modal, 'question', text)
})

// load an error dialog
ipcMain.on('showErrorDialog', (event, content) => {
    var fatal = false
    
    if (content.fatal) {
        fatal = true
        global.sharedObject.sysLogger.error(content.text)
    }
    
    if (modal === undefined || modal == null)
        createDialog(event, global.sharedObject.win, 'error', content.text, fatal)
    else
        createDialog(event, modal, 'error', content.text, fatal)
})

// open a modal for the user to enter the information necessary to fund a project
ipcMain.on('showFundModal', (event, args) => {
    // load a modal
    global.activeProject = args.project
    createModal('fund')
})

// load an info dialog
ipcMain.on('showInfoDialog', (event, text) => {    
    if (modal === undefined || modal == null)
        createDialog(event, global.sharedObject.win, 'info', text)
    else
        createDialog(event, modal, 'info', text)
})

// close the splash screen and show the main window, sent from the background window
ipcMain.on('showMainWindow', (event, args) => {
    //setTimeout(function() {
        closeSplashScreen()
        bgWin.show()
    //}, 12000)
})

// show a print dialog for the paper wallets modal
ipcMain.on('showPrintDialog', (event, args) => {
    modal.webContents.print({printBackground: true})
})

// launching RPC explorer
ipcMain.on('rpcExplorerLaunch', (event, args) => {
    if (global.sharedObject.win)
        global.sharedObject.win.webContents.send('rpcExplorerLaunch', {isOnline: global.sharedObject.isOnline})
})

// launching SmartCash core
ipcMain.on('smartcashLaunch', (event, args) => {
    if (global.sharedObject.win)
        global.sharedObject.win.webContents.send('smartcashLaunch', {isOnline: global.sharedObject.isOnline})
})

// sweep project funds
ipcMain.on('sweepFunds', (event, args) => {
    global.taskStatus.set('sweepFunds', {status: false, error: false})
    global.apiCallbackInfo.set('sweepFunds', {
        apiCallbackCounter: 0,
        totalProjects: args.projectIDs.length,
        projectNames: []
    })
    
    var index
    var project
    var unclaimedWallets
    
    loadProjects()
    args.projectIDs.forEach(function(projectID, key) {
        index = getDbIndex(projectID)
        project = global.availableProjects.list[index]
        global.apiCallbackInfo.get('sweepFunds').projectNames.push(project.name)
        
        smartcashapi.sweepFunds({referrer: "sweepFunds", projectIndex: index, projectID: projectID, project: project}, apiCallback)
    })
})

// return the current status of long-running tasks
ipcMain.on('taskStatusCheck', (event, args) => {    
    if (global.taskStatus.get(args)) {
        var status = global.taskStatus.get(args).status
        var error = global.taskStatus.get(args).error

        if (global.sharedObject.win)
            global.sharedObject.win.webContents.send('taskStatusCheckDone', {function: args, status: status, error: error})
    }
})

// update a project edited in the modal
ipcMain.on('updateProject', (event, args) => {
    modal.close()
    global.activeProject = args.activeProject
    loadProjects()
    var index = getDbIndex(global.activeProject.id)
    global.availableProjects.list[index] = global.activeProject
    db.set('projects', global.availableProjects)
    global.sharedObject.logger.info('Project "' + global.activeProject.name + '" was edited.')
    refreshLogFile()
    global.activeProject = null
    
    if (global.sharedObject.win)
        global.sharedObject.win.webContents.send('projectsReady')
})