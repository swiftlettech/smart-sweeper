/* Main app logic. */
const electron = require('electron')
const {app, BrowserWindow, dialog, ipcMain, shell} = electron
const path = require('path')
const url = require('url')
const fs = require('fs')
const util = require('util')

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
            
            if (options.level === "error") {
                this.logDBSystem = new Store({name: options.filename})
                
                if (this.logDBSystem.get('log') === undefined)
                    this.logDBSystem.set('log', [])
            }
            else {
                this.logDBUser = new Store({name: options.filename})
                
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
            
            //console.log('info')
            //console.log(info)
            //console.log('self')
            //console.log(self)
            
            if (info.level === "error")
                logDB = self.logDBSystem
            else
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
    // create global object to be shared amongst renderer processes
    global.sharedObject = {
        txFee: 0.002, // minimum transaction fee
        explorerCheckInterval: 1.2, // minimum time between block explorer requests
        win: null,
        logger: null,
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
        
        if (global.sharedObject.win) {
            if (property === "isOnline") {
                global.sharedObject.win.webContents.send('onlineCheckAPP', {isOnline: global.sharedObject.isOnline})
                global.sharedObject.win.webContents.send('isOnline')
            }
            else if (property === "coreRunning") {
                global.sharedObject.win.webContents.send('coreCheckAPP', {coreRunning: global.sharedObject.coreRunning})
                global.sharedObject.win.webContents.send('coreRunning')
            }
            else if (property === "coreError") {
                global.sharedObject.win.webContents.send('coreCheckAPP', {coreError: global.sharedObject.coreError})
                global.sharedObject.win.webContents.send('coreError')
            }
            else if (property === "rpcConnected") {
                global.sharedObject.win.webContents.send('rpcCheckAPP', {rpcConnected: global.sharedObject.rpcConnected})
                global.sharedObject.win.webContents.send('rpcConnected')
            }
            else if (property === "rpcError") {
                global.sharedObject.win.webContents.send('rpcCheckAPP', {rpcError: global.sharedObject.rpcError})
                global.sharedObject.win.webContents.send('rpcError')
            }
            else if (property === "coreSynced") {
                global.sharedObject.win.webContents.send('coreSyncCheckAPP', {coreSynced: global.sharedObject.coreSynced})
                global.sharedObject.win.webContents.send('coreSynced')
            }
            else if (property === "coreSyncError") {
                global.sharedObject.win.webContents.send('coreSyncCheckAPP', {coreSyncError: global.sharedObject.coreSyncError})
                global.sharedObject.win.webContents.send('coreSyncError')
            }
            else if (property === "blockExplorerError") {
                global.sharedObject.win.webContents.send('blockExplorerErrorAPP', {blockExplorerError: global.sharedObject.blockExplorerError})
            }
        }
    }, 0, true)
    
    // send a notice to renderer when availableProjects is updated
    watch(global.availableProjects, function(property, action, newValue, oldValue) {
        if (global.sharedObject.win)
            global.sharedObject.win.webContents.send('projectsReady')
    })
    
    global.referrer = ""
    global.apiCallbackInfo = new Map() // keeps track of API callback vars per function call
    
    // app config
    ipcMain.setMaxListeners(0) // set max listeners to unlimited
    
    // load the project db or create it if it doesn't exist
    // saved in %APPDATA%/smart-sweeper on Win
    // saved in $XDG_CONFIG_HOME/smart-sweeper or ~/.config/smart-sweeper on Linux
    // saved in ~/Library/Application Support/smart-sweeper on Mac
    try {
        db = new Store({name: "smart-sweeper"})
        global.availableProjects = db.get('projects')
        if (global.availableProjects === undefined) {
            db.set('projects', {index: 0, list: []})
            global.availableProjects = db.get('projects')
        }
    }
    catch(err) {
        createDialog(null, global.sharedObject.win, "error", err, true)
    }
    
    // load the internal config or create it if it doesn't exist
    // saved in %APPDATA%/smart-sweeper on Win
    // saved in $XDG_CONFIG_HOME/smart-sweeper or ~/.config/smart-sweeper on Linux
    // saved in ~/Library/Application Support/smart-sweeper on Mac
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
    
    // setup logging
    logFile = getCurrentDate()
    
    winston.loggers.add('logger', {
        format: combine(timestamp(), prettyPrint()),
        transports: [
            new module.exports.JsonDBTransport({ filename: path.join(userLogsPath, logFile), level: 'info' }),
            new module.exports.JsonDBTransport({ filename: path.join(sysLogsPath, logFile), level: 'error' })
        ],
        exitOnError: false
    })
    
    global.sharedObject.logger = winston.loggers.get('logger')
    global.sharedObject.logger.emitErrs = true
    smartcashapi.init()
    
    //if (isDev)
        //global.sharedObject.logger.add(new transports.Console({format: format.simple()}))
}

// some code from: https://github.com/trodi/electron-splashscreen
function createSplashScreen() {
    // set up splash screen
    const splashScreenConfig = {
        backgroundColor: '#FFF',
        width: 330,
        height: 330,
        frame: false,
        center: true,
        webPreferences: {
            devTools: false,
            nodeIntegration: false,
            sandbox: true
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
        splashScreen.show()
    })
}

function closeSplashScreen() {
    if (splashScreen) {
        splashScreen.close()
        splashScreen = null
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

    // Create the browser window.
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
            bgWin.show()
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
        title = "Edit Project"
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
        title = "Paper Wallet Generator"
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
        title = "Fund Project"
        parent = global.sharedObject.win
        width = Math.ceil(winBounds.width - (winBounds.width*0.45))
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
        
        if (fatal) {
            app.exit()
        }
    })
}

/* Generic API callback function. */
let apiCallback = function(resp, functionName, projectInfo) {
    var referrer = projectInfo.referrer
    var apiCallbackInfo = global.apiCallbackInfo.get(referrer)
    
    /*if (referrer === "getClaimedFundsInfo") {
        console.log('apiCallback referrer: ', referrer)
        console.log('apiCallbackInfo: ', apiCallbackInfo)
        console.log()
    }*/
    
    if (apiCallbackInfo !== undefined) {
        if (resp.type === "data") {
            /*if (referrer === "getClaimedFundsInfo") {
                console.log('projectInfo: ', projectInfo)
                //console.log('from ' + functionName)
                console.log(resp)
                console.log()
            }*/

            if (functionName === "checkBalance") {
                if (referrer === "getClaimedFundsInfo") {
                    if (resp.msg == 0 && !global.availableProjects.list[projectInfo.projectIndex].fundsSwept) {
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
                                obj[projectInfo.txid] = true
                                apiCallbackInfo.balance += tx.value
                            }
                            else
                                obj[projectInfo.txid] = false

                            apiCallbackInfo.txInfo.push(obj)
                        }
                    })
                }
                else if (referrer === "checkProjectBalances") {                
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

                    if (resp.msg.confirmations < 6) {
                        apiCallbackInfo.pendingFunds += projectInfo.addrAmt
                        apiCallbackInfo.pendingWallets++
                    }
                    else {
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
                global.sharedObject.blockExplorerError = false

                if ((referrer === "getClaimedFundsInfo") && (apiCallbackCounter == apiCallbackInfo.totalAddrs)) {
                    // store the claimed funds and claimed wallets total in a config file
                    global.savedAppData.claimedFundsTotal = apiCallbackInfo.claimedFunds
                    global.savedAppData.claimedWalletsTotal = apiCallbackInfo.claimedWallets
                    savedAppData.set('config', global.savedAppData)

                    // calculate the number of claimed wallets per project
                    var claimed
                    global.availableProjects.list.forEach(function(project, projectKey) {
                        claimed = 0

                        if (project.fundsSent) {
                            project.recvAddrs.forEach(function(address, addressKey) {
                                if (address.claimed)
                                    claimed++
                            })

                            project.claimedAddr = claimed
                        }
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
                            
                            totalSweptFunds = totalSweptFunds + (projectSweptFunds - global.sharedObject.txFee)
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

                    console.log('apiCallbackInfo.txInfo: ', apiCallbackInfo.txInfo)

                    apiCallbackInfo.txInfo.forEach(function(tx, key) {
                        txids.push(tx)

                        if (Object.values(tx)[0])
                           confirmedCounter++
                    })

                    if (confirmedCounter == apiCallbackInfo.txInfo.length) {
                        global.availableProjects.list[projectInfo.projectIndex].originalFunds = apiCallbackInfo.balance
                        global.availableProjects.list[projectInfo.projectIndex].txid = txids
                        global.availableProjects.list[projectInfo.projectIndex].txConfirmed = true
                    }
                    else {
                        global.availableProjects.list[projectInfo.projectIndex].txConfirmed = false
                    }

                    db.set('projects', global.availableProjects)
                    
                    if (global.sharedObject.win) {
                        global.sharedObject.win.webContents.send('projectsReady')
                        modal.webContents.send('fundingTxidsChecked', {msgType: 'data', confirmed: global.availableProjects.list[projectInfo.projectIndex].txConfirmed, txInfo: apiCallbackInfo.txInfo, balance: apiCallbackInfo.balance})
                    }
                    
                    global.apiCallbackInfo.delete(referrer)
                }
                else if ((referrer === "checkProjectBalances") && (apiCallbackCounter == apiCallbackInfo.totalTxs)) {
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

                    if (global.sharedObject.win) {
                        global.sharedObject.win.webContents.send('allTxInfo', {pendingFunds: apiCallbackInfo.pendingFunds, pendingWallets: apiCallbackInfo.pendingWallets, confirmedFunds: apiCallbackInfo.confirmedFunds, confirmedWallets: apiCallbackInfo.confirmedWallets})
                    }
                    
                    global.apiCallbackInfo.delete(referrer)
                }
            }
            else if (functionName === "getAddressInfo") {
                if (referrer === "getProjectAddressInfo" && global.sharedObject.win) {
                    modal.webContents.send('gotAddressInfo', {msgType: 'data', balance: apiCallbackInfo.balance, txs: apiCallbackInfo.txs})
                    global.apiCallbackInfo.delete(referrer)
                }
            }
            else if (functionName === "sendFunds") {
                if ((referrer === "fundProject")) {
                    global.availableProjects.list[projectInfo.projectIndex].projectFunded = true
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
                global.sharedObject.logger.info('Funds were swept for project "' + projectInfo.projectName + '".')
                refreshLogFile()
                
                if (global.sharedObject.win) {
                    global.sharedObject.win.webContents.send('fundsSwept', {msgType: 'data', msg: 'Funds were swept for "' + projectInfo.projectName + '".'})
                }
            }
        }
        else if (resp.type === "error") {
            console.log('error msg: ', resp.msg)

            if (projectInfo.projectName) {
                global.sharedObject.logger.error(functionName + ': ' + resp.msg + " project " + projectInfo.projectName)

                /*if (referrer === "fundProject" && global.sharedObject.win) {
                    apiCallbackInfo.msg = resp.msg
                    modal.webContents.send('fundingTxidChecked', {msgType: 'error', msg: apiCallbackInfo.msg})
                }*/

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
            else {
                global.sharedObject.logger.error(functionName + ': ' + resp.msg)
            }
        }
    }
}

// automatically sweep project funds if sweep date has expired
function autoSweepFunds() {
    /*global.availableProjects.list.forEach(function(project, projectKey) {
        project.recvAddrs.forEach(function(address, addrKey) {
            
        })
    })
    
    global.sharedObject.logger.info('Funds were automatically swept for project "' + global.activeProject.name + '".')
    refreshLogFile()*/
}

// create the receiver addresses for a project
function createRecvAddresses(project) {
    project.recvAddrs = []
    let addressPair
    
    for (var i=0; i<project.numAddr; i++) {
        addressPair = smartcashapi.generateAddress()
        addressPair.claimed = false
        project.recvAddrs.push(addressPair)
    }
    project.claimedAddr = 0
    
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
function getNewestLogFile(type) {
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
    
    files.forEach(function(file, index) {
        stats = fs.statSync(logPath + file)        
        if (stats.mtime > mostRecent.lastModified)
            mostRecent = {file: file, lastModified: stats.mtime}
    })
    
    return mostRecent
}

// load the most recent log file
function loadLog() {
    var mostRecent = getNewestLogFile('user')
    logFile = path.join(userLogsPath, path.parse(mostRecent.file).name)
    
    var logDB = new Store({name: logFile})
    return {content: logDB.get('log'), date: mostRecent.lastModified}
}

// create a project
function newProject(event, project) {
    var newProject = project
    newProject.id = global.availableProjects.index + 1
    newProject.originalFunds = 0
    newProject.autoSweep = false // because auto-sweep hasn't been implemented
    newProject.addressPair = {}
    
    var addressPair = smartcashapi.generateAddress()
    newProject.addressPair.publicKey = addressPair.publicKey
    newProject.addressPair.privateKey = addressPair.privateKey
    
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
    var stats = fs.statSync(path.join(app.getPath('userData'), userLogsPath, logFile, '.json'))
    var logDB = new Store({name: getCurrentDate()})
    var log = logDB.get('log')
    global.availableLog = {date: stats.mtime, content: log}
    
    if (global.sharedObject.win)
        global.sharedObject.win.webContents.send('logReady')
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
    logFile = path.join(userLogsPath, path.parse(mostRecent.file).name)
    var logDB = new Store({name: logFile})

    if (logDB.get('log').length == 0) {
        fs.unlink(app.getPath('userData') + path.sep + logFile + '.json', (err) => {
            if (err) throw err;
        })
    }

    mostRecent = getNewestLogFile('system')
    logFile = path.join(sysLogsPath, path.parse(mostRecent.file).name)
    logDB = new Store({name: logFile})

    if (logDB.get('log').length == 0) {
        fs.unlink(app.getPath('userData') + path.sep + logFile + '.json', (err) => {
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



// check the txid to get project funding info
ipcMain.on('checkFundingTxids', (event, args) => {
    console.log(args)
    
    global.apiCallbackInfo.set('checkFundingTxids', {
        apiCallbackCounter: 0,
        txCount: args.activeTxs.length,
        txInfo: [],
        balance: 0
    })
    
    var index = getDbIndex(args.projectID)
    args.activeTxs.forEach(function(tx, key) {
        smartcashapi.checkTransaction({referrer: "checkFundingTxids", projectID: args.projectID, projectName: args.projectName, projectIndex: index, balance: args.balance, address: args.address, txid: tx}, apiCallback)
    })
    
    /*else {
        // check one        
        global.apiCallbackInfo.set('getProjectTxStatus', {
            apiCallbackCounter: 0,
            totalProjects: 1
        })
        
        var index = getDbIndex(project.id)
        var project = global.availableProjects.list[index]
        var txids
        
        project.txid.forEach(function(txid, key) {
            txids.push(txid)
        })
        
        smartcashapi.checkTransaction({referrer: "getProjectTxStatus", projectName: project.name, projectIndex: index, txid: project.txid}, apiCallback)
    }*/
})

// check the funded balances of all projects
ipcMain.on('checkProjectBalances', (event, args) => {
    var totalTxs = 0
    
    if (global.availableProjects === undefined)
        global.availableProjects = db.get('projects')
    
    global.availableProjects.list.forEach(function(project, projectKey) {
        if (project.projectFunded)
            totalTxs += project.txid.length
    })
    
    if (totalTxs > 0) {
        global.apiCallbackInfo.set('checkProjectBalances', {
            apiCallbackCounter: 0,
            totalTxs: totalTxs,
            total: 0
        })

        global.availableProjects.list.forEach(function(project, projectKey) {
            if (project.projectFunded) {
                smartcashapi.checkTransaction({referrer: "checkProjectBalances", projectName: project.name, projectIndex: projectKey, fundsSent: project.fundsSent, address: project.addressPair.publicKey, txid: project.txid}, apiCallback)
            }
        })
    }
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

// send funds to a project
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
    
    var index = getDbIndex(args.projectID)    
    smartcashapi.getAddressInfo({referrer: "getProjectAddressInfo", projectID: args.projectID, projectName: args.projectName, projectIndex: index, address: args.address}, apiCallback);
})

// get the status of one or all project funding transactions
ipcMain.on('getProjectTxStatus', (event, args) => {
    //console.log('in getProjectTxStatus')
    
    var totalProjects = 0

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
                        smartcashapi.checkTransaction({referrer: "getWalletTxStatus", projectName: project.name, txid: address.sentTxid, addrAmt: project.addrAmt}, apiCallback)
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
    shell.showItemInFolder(app.getPath('userData') + path.sep + logFile + '.json')
})

// user confirmation that the project has been fully funded
ipcMain.on('projectFullyFunded', (event, args) => {
    var index = getDbIndex(global.activeProject.id)
    global.availableProjects.list[index].projectFunded = true
    db.set('projects', global.availableProjects)
    
    if (global.sharedObject.win)
        global.sharedObject.win.webContents.send('projectsReady')
    
    global.sharedObject.logger.info('Project "' + global.activeProject.name + '" was marked "fully funded".')
    refreshLogFile()
})

// send funds to receiver addresses
ipcMain.on('sendPromotionalFunds', (event, args) => {    
    // calculate and save the amount per address
    var totalAmtToSend = args.originalFunds-global.sharedObject.txFee
    var amtPerWallet = totalAmtToSend / args.wallets.length
    console.log('amtToSend: ', amtToSend)
    
    console.log('args.originalFunds: ', args.originalFunds)
    console.log('global.sharedObject.txFee: ', global.sharedObject.txFee)
    console.log('args.wallets.length: ', args.wallets.length)
    
    var index = getDbIndex(args.projectID)
    global.availableProjects.list[index].addrAmt = amtToSend
    db.set('projects', global.availableProjects)
    
    var toAddr = []
    args.wallets.forEach(function(wallet, key) {
        toAddr.push(wallet.publicKey)
    })
    console.log('toAddr: ', toAddr)
    
    global.apiCallbackInfo.set('sendPromotionalFunds', {
        apiCallbackCounter: 0
    })
    
    smartcashapi.sendFunds({referrer: "sendPromotionalFunds", projectIndex: index, projectName: global.availableProjects.list[index].name, total: totalAmtToSend, amount: amtPerWallet, fromAddr: args.fromAddr, fromPK: args.fromPK, toAddr: toAddr}, apiCallback);
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
        global.sharedObject.logger.error(content.text)
    }
    
    if (modal === undefined || modal == null)
        createDialog(event, global.sharedObject.win, 'error', content.text)
    else
        createDialog(event, modal, 'error', content.text)
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
    global.apiCallbackInfo.set('sweepFunds', {
        apiCallbackCounter: 0,
        totalProjects: args.projectIDs.length
    })
    
    var index
    var project
    var unclaimedWallets
    
    args.projectIDs.forEach(function(projectID, projectKey) {
        index = getDbIndex(projectID)
        project = global.availableProjects.list[index]        
        smartcashapi.sweepFunds({referrer: "sweepFunds", projectIndex: index, projectID: project.id, project: project}, apiCallback)
    })
})

// update a project edited in the modal
ipcMain.on('updateProject', (event, args) => {
    modal.close()
    global.activeProject = args.activeProject
    var index = getDbIndex(global.activeProject.id)
    global.availableProjects.list[index] = global.activeProject
    db.set('projects', global.availableProjects)
    global.sharedObject.logger.info('Project "' + global.activeProject.name + '" was edited.')
    refreshLogFile()
    global.activeProject = null
    
    if (global.sharedObject.win)
        global.sharedObject.win.webContents.send('projectsReady')
})