/* Main app logic. */
const electron = require('electron')
const {app, BrowserWindow, dialog, ipcMain, shell} = electron
const path = require('path')
const url = require('url')
//const cp = require('child_process')
const fs = require('fs')
const util = require('util')

const winston = require('winston')
const Transport = require('winston-transport')
const {createLogger, format, transports} = winston
const {combine, timestamp, prettyPrint} = format

const Store = require('electron-store')
const smartcashapi = require('./smartcashapi')
const rpcenv = require("./rpc-explorer/app/env")
const {watch} = require('melanke-watchjs')
const isOnline = require('is-online')
//const {is} = require('electron-util')
const baseLogPath = "logs"
const sysLogsPath = baseLogPath + path.sep + 'system'
const userLogsPath = baseLogPath + path.sep + 'user'
const isDev = require('electron-is-dev')
require('electron-debug')({showDevTools: true})

let splashScreen, bgWin, modal, modalType, logger, logFile, db, apiCallbackCounter

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
            let self = this
            
            setImmediate(function () {
                self.emit('logged', info)
            })
            
            let logDB
            
            console.log('info')
            console.log(info)
            console.log('self')
            console.log(self)
            
            if (info.level === "error")
                logDB = self.logDBSystem
            else
                logDB = self.logDBUser
            
            if (logDB !== undefined) {
                let log = logDB.get('log')
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
    // app config
    ipcMain.setMaxListeners(0)
    
    // load the project db or create it if it doesn't exist
    // saved in %APPDATA%/smart-sweeper on Win
    // saved in $XDG_CONFIG_HOME/smart-sweeper or ~/.config/smart-sweeper on Linux
    // saved in ~/Library/Application Support/smart-sweeper on Mac
    db = new Store({name: "smart-sweeper"})
    global.availableProjects = db.get('projects')    
    if (global.availableProjects === undefined) {
        db.set('projects', {index: 0, list: []})
        global.availableProjects = db.get('projects')
    }
    
    // setup logging
    logFile = getCurrentDate()
    
    winston.loggers.add('logger', {
        format: combine(timestamp(), prettyPrint()),
        transports: [
            new module.exports.JsonDBTransport({ filename: userLogsPath + path.sep + logFile, level: 'info' }),
            new module.exports.JsonDBTransport({ filename: sysLogsPath + path.sep + logFile, level: 'error' })
        ],
        exitOnError: false
    })
    logger = winston.loggers.get('logger')
    logger.emitErrs = true
    
    if (isDev)
        logger.add(new transports.Console({format: format.simple()}))
    
    /*logger = createLogger({
        //level: 'error',
        format: combine(timestamp(), prettyPrint()),
        transports: [
            new module.exports.JsonDBTransport({ filename: sysLogsPath + path.sep + logFile, level: 'error' }),
            new module.exports.JsonDBTransport({ filename: userLogsPath + path.sep + logFile, level: 'info' })
        ],
        exitOnError: false
    })
    logger.emitErrs = false*/
    
    // create global object to be shared amongst renderer processes
    global.sharedObject = {
        win: null,
        isOnline: false,
        referrer: "",
        client: null,        
        rpcExplorer: null,
        coreRunning: false,
        coreError: false,
        rpcExplorerRunning: false,
        rpcExplorerError: false
    }
    
    // watch for changes on the shared object
    watch(global.sharedObject, function(property, action, newValue, oldValue) {
        console.log(property)
        console.log(oldValue)
        console.log(newValue)
        
        if (global.sharedObject.win) {
            if (property === "isOnline")
                global.sharedObject.win.webContents.send('onlineCheckAPP', {isOnline: global.sharedObject.isOnline})
            else if (property === "coreRunning")
                global.sharedObject.win.webContents.send('coreCheckAPP', {coreRunning: global.sharedObject.coreRunning})
            else if (property === "coreError")
                global.sharedObject.win.webContents.send('coreCheckAPP', {coreError: global.sharedObject.coreError})
            else if (property === "rpcExplorerRunning") {
                global.sharedObject.win.webContents.send('rpcExplorerCheckAPP', {rpcExplorerRunning: global.sharedObject.rpcExplorerRunning})
                global.sharedObject.win.webContents.send('rpcClientCreated')
            }
            else if (property === "rpcExplorerError")
                global.sharedObject.win.webContents.send('rpcExplorerCheckAPP', {rpcExplorerError: global.sharedObject.rpcExplorerError})
            else if (property === "client")
                global.client = newValue
        }
    }, 0, true);
    
    // global shared callback object
    global.callbackObj = {}
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
            preload: path.join(__dirname, 'preload.js')
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
        //bgWin.show()
        
        setTimeout(function() {closeSplashScreen()}, 12000)
    })

    bgWin.on('closed', () => {
        smartcashapi.disconnRpcExplorer();
        
        if (global.sharedObject.rpcExplorer)
            global.sharedObject.rpcExplorer.kill()
        
        bgWin = null
    })
}

// create the main window
function createWindow() {
    const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize    
    const windowConfig = {
        title: "SMART Sweeper",
        width: width, //1000,
        height: height, //600,
        center: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
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
        //global.sharedObject.win.show()
    })
    
    global.sharedObject.win.on('show', () => {
        global.sharedObject.win.webContents.send('projectsReady')
        
        isOnline().then(online => {
            global.sharedObject.isOnline = online;

        })
    })

    // Emitted when the window is closed.
    global.sharedObject.win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        bgWin.close()        
        global.sharedObject.win = null
    })
}

// create a modal
function createModal(type, text) {
    let parent, title, width, height, pathname, resizable, minimizable, maximizable, alwaysOnTop, fullscreenable
    
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
        width = Math.ceil(winBounds.width - (winBounds.width*0.52))
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
        //width = Math.ceil(winBounds.width - (winBounds.width*0.6))
        //height = Math.ceil(winBounds.height - (winBounds.height*0.15))
        width = winBounds.width
        height = winBounds.height
        pathname = path.join(__dirname, 'app', 'fund', 'fundModal.html')
        resizable = true
        minimizable = true
        maximizable = true
        alwaysOnTop = false
        fullscreenable = true
    }
    
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
    let buttons
    
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
        
        if (fatal)
            app.quit()
    })
}

/* Generic API callback function. */
let apiCallback = function(resp, functionName, projectInfo) {
    if (resp.type === "data") {
        console.log('from ' + functionName)
        console.log(resp)
        
        if (functionName === "checkBalance") {
            global.availableProjects.list[projectInfo.projectIndex].totalFunds = parseFloat(resp.msg)
        }
        else if (functionName === "checkPending") {
            if (resp.msg < 6) {
                global.callbackObj.pendingFunds += addrAmt
                global.callbackObj.pendingWallets++
            }
        }
        /*else if (functionName === "checkConfirmed")*/
        /*else if (functionName === "checkClaimed")*/
        /*else if (functionName === "checkSwept")*/
        /*else if (functionName === "")*/
        
        /*if (projectInfo)
            return {resp: resp, projectInfo: projectInfo}
        else
            return resp*/
        
        //global.availableProjects.list[projectInfo.projectIndex].totalFunds = parseFloat(resp.msg)
    }
    else if (resp.type === "error") {
        if (projectInfo)
            logger.error(functionName + ': ' + resp.msg + "project " + projectInfo.projectName)
        else
            logger.error(functionName + ': ' + resp.msg)
    }

    apiCallbackCounter++
    
    if (functionName === "checkBalance") {
        if (apiCallbackCounter == global.availableProjects.list.length) {
            db.set('projects', global.availableProjects)
            global.sharedObject.win.webContents.send('balancesChecked')
            global.sharedObject.win.webContents.send('projectsReady')
        }
    }
    else if (functionName === "checkPending") {
        if (callbackCounter == totalAddrs)
            event.sender.send('pendingFundsInfo', {pendingFunds: pendingFunds, pendingWallets: pendingWallets})
    }
    else if (functionName === "checkTransaction") {
        if (apiCallbackCounter == projectInfo.totalAddresses) {
            
        }
    }

    /*if (functionName === "sendFunds") {
        if (callbackCounter == global.availableProjects.list.length) {
            callbackCounter = 0
            db.set('projects', global.availableProjects)
        }
    }
    else if (functionName === "sweepFunds") {
        
    }*/
}

/*let apiCallback = function(resp, functionName, projectInfo) {       
    if (resp.type === "data") {
        global.availableProjects.list[projectInfo.projectIndex].totalFunds = parseFloat(resp.msg)
    }
    else if (resp.type === "error") {            
        logger.error(functionName + ': ' + resp.msg + "project " + projectInfo.projectName)
    }

    apiCallbackCounter++

    if (functionName === "checkProjectBalances") {
        /*if (apiCallbackCounter == global.availableProjects.list.length) {
            apiCallbackCounter = 0
            db.set('projects', global.availableProjects)
            global.sharedObject.win.webContents.send('balancesChecked')
            global.sharedObject.win.webContents.send('projectsReady')
        }
    }
}*/

// automatically sweep project funds if sweep date has expired
function autoSweepFunds() {
    /*global.availableProjects.list.forEach(function(project, projectKey) {
        project.recvAddrs.forEach(function(address, addrKey) {
            
        })
    })
    
    logger.info('Funds were automatically swept for project "' + global.activeProject.name + '".')
    refreshLogFile()*/
}

// create the receiver addresses for a project
function createRecvAddresses(project) {
    let addressPair
    
    for (let i=0; i<project.numAddr; i++) {
        addressPair = smartcashapi.generateAddress()
        project.recvAddrs.push(addressPair)
    }
    
    let index = getDbIndex(project.id)
    global.availableProjects.list[index] = project
    global.activeProject = project
    db.set('projects', global.availableProjects)
    
    logger.info('Receiver addresses for project "' + project.name + '" were created.')
    refreshLogFile()
}

// get the current date and format it as YYYYMMDD
function getCurrentDate() {
    let today = new Date()
    let year = today.getFullYear()
    let month = today.getMonth() + 1
    let day = today.getDate()
    
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
    let arrayIndex
    
    global.availableProjects.list.forEach(function(project, index) {
        if (project.id == projectID)
            arrayIndex = index
    })
    
    return arrayIndex
}

// find the newest user log or system log file
function getNewestLogFile(type) {
    let logPath
    
    if (type === "user")
        logPath = app.getPath('userData') + path.sep + userLogsPath + path.sep
    else if (type === "system")
        logPath = app.getPath('userData') + path.sep + sysLogsPath + path.sep
    
    let files = fs.readdirSync(logPath)
    if (files.length == 0) {
        global.availableLog = null
        event.sender.send('logReady')
        return
    }
    
    let stats = fs.statSync(logPath + files[0])
    let mostRecent = {file: files[0], lastModified: stats.mtime}
    
    files.forEach(function(file, index) {
        stats = fs.statSync(logPath + file)        
        if (stats.mtime > mostRecent.lastModified)
            mostRecent = {file: file, lastModified: stats.mtime}
    })
    
    return mostRecent
}

// load the most recent log file
function loadLog() {
    let mostRecent = getNewestLogFile('user')
    logFile = userLogsPath + path.sep + path.parse(mostRecent.file).name
    
    let logDB = new Store({name: logFile})
    return {content: logDB.get('log'), date: mostRecent.lastModified}
}

// create a project
function newProject(event, project) {
    let newProject = project
    newProject.id = global.availableProjects.index + 1
    newProject.totalFunds = 0
    newProject.addressPair = {}
    
    let addressPair = smartcashapi.generateAddress()
    newProject.addressPair.publicKey = addressPair.publicKey
    newProject.addressPair.privateKey = addressPair.privateKey
    
    global.availableProjects.index = global.availableProjects.index + 1
    global.availableProjects.list.push(newProject)
    db.set('projects', global.availableProjects)
    
    logger.info('Project "' + newProject.name + '" was created.')
    refreshLogFile()
    event.sender.send('newProjectAdded')
    global.sharedObject.win.webContents.send('projectsReady')
}

// refresh the log currently loaded in the app
function refreshLogFile() {
    let stats = fs.statSync(app.getPath('userData') + path.sep + userLogsPath + path.sep + logFile + '.json')
    let logDB = new Store({name: getCurrentDate()})
    let log = logDB.get('log')
    global.availableLog = {date: stats.mtime, content: log}
    global.sharedObject.win.webContents.send('logReady')
}

// set the active project based on a project ID
function setActiveProject(projectID) {
    let index = getDbIndex(projectID)
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
        
        // create a testnet address and save to a file
        /*let adddressPair = smartcashapi.generateAddress()
        fs.writeFile('test_address.txt', adddressPair.publicKey + '\n' + adddressPair.privateKey, (err) => {
          if (err) throw err;
        })*/
    }
})

// quit when all windows are closed.
app.on('window-all-closed', () => {
    // delete the user and system log files if they're empty
    let mostRecent = getNewestLogFile('user')
    logFile = userLogsPath + path.sep + path.parse(mostRecent.file).name
    let logDB = new Store({name: logFile})

    if (logDB.get('log').length == 0) {
        fs.unlink(app.getPath('userData') + path.sep + logFile + '.json', (err) => {
            if (err) throw err;
        })
    }

    mostRecent = getNewestLogFile('system')
    logFile = sysLogsPath + path.sep + path.parse(mostRecent.file).name
    logDB = new Store({name: logFile})

    if (logDB.get('log').length == 0) {
        fs.unlink(app.getPath('userData') + path.sep + logFile + '.json', (err) => {
            if (err) throw err;
        })
    }
        
    
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (global.sharedObject.win === null) {
        createWindow()
        global.sharedObject.win.maximize()
    }
})


// check the balance of all projects
ipcMain.on('checkProjectBalances', (event, args) => {
    var apiCallbackCounter = 0
    
    if (global.availableProjects === undefined)
        global.availableProjects = db.get('projects')
    
    global.availableProjects.list.forEach(function(project, projectKey) {
        smartcashapi.checkBalance({address: project.addressPair.publicKey, projectID: project.id, projectIndex: projectKey, projectName: project.name}, apiCallback)
    })
})

// create paper wallets
ipcMain.on('createPaperWallets', (event, args) => {
    let index = getDbIndex(args.projectID)
    global.activeProject = global.availableProjects.list[index]
    modalType = "paperWallets"
    createModal('paperWallets')
})

// create the receiver addresses for a project
ipcMain.on('createRecvAddresses', (event, args) => {    
    if (args.newProjectFlag) {
        newProject(event, args.project)
        
        let index = getDbIndex(args.project.id)
        global.activeProject = global.availableProjects.list[index]
    }
    
    createRecvAddresses(args.project)
    event.sender.send('addressesCreated')
    global.sharedObject.win.webContents.send('projectsReady')
})

// delete a project
ipcMain.on('deleteProject', (event, args) => {
    let index = getDbIndex(args.id)
    let name = global.availableProjects[index].name
    global.availableProjects.list.splice(index, 1)
    db.set('projects', global.availableProjects)
    logger.info('Project "' + name + '" was deleted.')
    refreshLogFile()
    global.sharedObject.win.webContents.send('projectsReady')
})


// load a modal to edit a project
ipcMain.on('editProject', (event, args) => {
    modalType = "edit"
    global.activeProject = args.project
    createModal('edit')
})

// send funds to a project
ipcMain.on('fundProject', (event, args) => {    
    // create and broadcast the transaction
    smartcashapi.sendFunds(args)
    
    // calculate and save the amount per address
    
    //logger.info('Project "' + global.activeProject.name + '" was funded.')
    //refreshLogFile()
})

// get the total amount of gift funds that have been claimed
ipcMain.on('getClaimedFundsInfo', (event, args) => {
    let totalAddrs = 0
    let callbackCounter = 0
    let claimedFunds = 0
    let claimedWallets = 0
    
    function callback(resp, projectInfo) {
        if (resp.type === "data" && parseInt(resp.msg) == 0) {
            claimedFunds += projectInfo.addrAmt
            claimedWallets++
        }
        else if (resp.type === "error") {
            logger.error('getClaimedFundsInfo: ' + resp.msg)
        }
        
        callbackCounter++
        
        if (callbackCounter == totalAddrs)
            event.sender.send('claimedFundsInfo', {claimedFunds: claimedFunds, claimedWallets: claimedWallets})
    }
    
    //console.log(args)
    
    if (args === undefined) {
        // get the claimed amount for all wallets for all projects
        global.availableProjects.list.forEach(function(project, projectKey) {
            project.recvAddrs.forEach(function(address, addrKey) {
                smartcashapi.checkBalance({address: address.publicKey, addrAmt: project.addrAmt}, callback)
                totalAddrs++
            })
        })
    }
    else {
        // get the claimed amount for all wallets for one project
        let index = getDbIndex(args.projectID)
        let project  = global.availableProjects.list[index]
        
        project.recvAddrs.forEach(function(address, addrKey) {                                      
            smartcashapi.checkBalance({address: address.publicKey, projectID: args.projectID, projectIndex: index, addrAmt: project.addrAmt}, callback)
            totalAddrs++
        })
    }
})

// get the total amount of transactions that have been confirmed
ipcMain.on('getConfirmedFundsInfo', (event, args) => {
    let totalAddrs = 0
    let callbackCounter = 0
    let confirmedFunds = 0
    let confirmedWallets = 0
    
    function callback(resp, addrAmt) {
        console.log(resp)
        
        if (resp.type === "data" && resp.msg >= 6) {
            confirmedFunds += addrAmt
            confirmedWallets++
        }
        else if (resp.type === "error") {
            logger.error('getConfirmedFundsInfo: ' + resp.msg)
        }
        
        callbackCounter++
        
        if (callbackCounter == totalAddrs)
            event.sender.send('confirmedFundsInfo', {confirmedFunds: confirmedFunds, confirmedWallets: confirmedWallets})
    }
    
    global.availableProjects.list.forEach(function(project, projectKey) {
        project.recvAddrs.forEach(function(address, addrKey) {
            if (address.txid !== undefined) {
                smartcashapi.checkTransaction(address.txid, project.addrAmt, callback)
                totalAddrs++
            }
        })
    })
})

// get the total amount of transactions that have yet to be confirmed
ipcMain.on('getPendingFundsInfo', (event, args) => {
    console.log('in getPendingFundsInfo')
    apiCallbackCounter = 0
    let totalAddrs = 0    
    global.callbackObj.pendingWallets = 0
    global.callbackObj.pendingFunds = 0
    
    global.availableProjects.list.forEach(function(project, projectKey) {
        if (project.fundsSent)
            totalAddrs += project.numAddr
    })
    
    if (totalAddrs > 0) {
        global.availableProjects.list.forEach(function(project, projectKey) {
            project.recvAddrs.forEach(function(address, addrKey) {
                if (project.fundsSent) {
                    smartcashapi.checkTransaction({totalAddrs: totalAddrs, txid: address.txid, addrAmt: project.addrAmt}, apiCallback)
                }
            })
        })
    }
})

// load the most recent log file
ipcMain.on('loadLog', (event, args) => {
    let log = loadLog()
    global.availableLog = {date: log.date, content: log.content}
    event.sender.send('logReady')
})

// modal "cancel"
ipcMain.on('modalNo', (event, args) => {
    global.activeProject = null
    modal.close()
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

// send funds to receiver addresses
ipcMain.on('sendFunds', (event, args) => {
    smartcash.sendFunds(args);
    
    //logger.info('Funds were send to wallets for project "' + global.activeProject.name + '".')
    //refreshLogFile()
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
    
    if (content.fatal)
        fatal = true
    
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

// show a print dialog for the paper wallets modal
ipcMain.on('showPrintDialog', (event, args) => {
    modal.webContents.print({printBackground: true})
})

// launching RPC explorer
ipcMain.on('rpcExplorerLaunch', (event, args) => {
    global.sharedObject.win.webContents.send('rpcExplorerLaunch', {isOnline: global.sharedObject.isOnline})
})

// launching SmartCash core
ipcMain.on('smartcashLaunch', (event, args) => {
    global.sharedObject.win.webContents.send('smartcashLaunch', {isOnline: global.sharedObject.isOnline})
})

// manually sweep project funds
ipcMain.on('sweepFunds', (event, projectID) => {
    let index = getDbIndex(projectID)
    let project = global.availableProjects.list[index]
    
    /*project.recvAddrs.forEach(function(addr, addrKey) {
        smartcashapi.sweepFunds({sender: addr, receiver: project.publicKey})
    })*/
    
    logger.info('Funds were manually swept for project "' + global.activeProject.name + '".')
    refreshLogFile()
})

// update a project edited in the modal
ipcMain.on('updateProject', (event, args) => {
    modal.close()
    global.activeProject = args.activeProject
    let index = getDbIndex(global.activeProject.id)
    global.availableProjects.list[index] = global.activeProject
    db.set('projects', global.availableProjects)
    logger.info('Project "' + global.activeProject.name + '" was edited.')
    refreshLogFile()
    global.activeProject = null
    global.sharedObject.win.webContents.send('projectsReady')
})