/* Main app logic. */
const electron = require('electron')
const {app, BrowserWindow, dialog, ipcMain, shell} = electron
const path = require('path')
const url = require('url')
const winston = require('winston')
const Transport = require('winston-transport')
const {createLogger, format, transports} = winston
const {combine, timestamp, prettyPrint} = format
const Store = require('electron-store')
const smartapi = require('./smartapi')
const fs = require('fs')
const util = require('util')
const baseLogPath = "logs"
const sysLogsPath = baseLogPath + path.sep + 'system'
const userLogsPath = baseLogPath + path.sep + 'user'
const isDev = require('electron-is-dev')
require('electron-debug')({showDevTools: true})

let win, modal, modalType, logger, logFile, db, projects

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
            
            if (info.level === "error")
                logDB = self.logDBSystem
            else
                logDB = self.logDBUser
            
            if (logDB !== undefined) {
                let log = logDB.get('log')
                log.push(info)
                logDB.set('log', log)
            }
            
            if (callback) { callback() }
        }
    }
}

// create the main window
function createWindow () {
    const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize
    
    // Create the browser window.
    win = new BrowserWindow({
        title: "SMART Sweeper",
        width: width, //1000,
        height: height, //600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })
    
    win.setMenu(null)

    // and load the index.html of the app.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }))

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    })
}

// create a modal
function createModal(type, text) {
    let parent, title, width, height, pathname, resizable, minimizable, maximizable, alwaysOnTop, fullscreenable
    
    winBounds = win.getBounds()
    
    if (type === "edit") {
        title = "Edit Project"
        parent = win
        //width = Math.ceil(winBounds.width - (winBounds.width*0.6))
        //height = Math.ceil(winBounds.height - (winBounds.height*0.15))
        width = winBounds.width
        height = winBounds.height
        pathname = path.join(__dirname, 'app', 'utils', 'editModal.html')
        resizable = true
        minimizable = true
        maximizable = true
        alwaysOnTop = false
        fullscreenable = true
    }
    else if (type === "paperWallets") {
        title = "Paper Wallet Generator"
        parent = win
        width = Math.ceil(winBounds.width - (winBounds.width*0.52))
        height = winBounds.height
        pathname = path.join(__dirname, 'app', 'fund', 'paperWallet.html')
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
        //else
            //modal.webContents.send('setModalText', text)
        
        modal.show()
    })
    
    modal.on('closed', () => {
        modal = null
    })
}

function createDialog(event, window, type, text) {
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
    })
}

// create the receiver addresses for a project
function createRecvAddresses(project) {
    let addressPair
    
    for (let i=0; i<project.numAddr; i++) {
        addressPair = smartapi.generateAddresses()
        project.recvAddrs.push(addressPair)
    }
    
    let index = getDbIndex(project.id)
    global.availableProjects.list[index] = project
    global.activeProject = project
    db.set('projects', global.availableProjects)
    logger.info('Receiver addresses for project "' + project.name + '" were created.')
    refreshLogFile()
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

// get the current date and format it as YYYYMMDD
function getCurrentDate() {
    let today = new Date()
    let year = today.getUTCFullYear()
    let month = today.getUTCMonth() + 1
    let day = today.getUTCDate()
    
    if (month < 10)
        month = "0" + String(month)
    else
        month = String(month)
    
    if (day < 10)
        day = "0" + String(day)
    else
        day = String(day)
    
    return String(year) + month + day;
}

// refresh the currently-loaded log file
function refreshLogFile() {
    let stats = fs.statSync(app.getPath('userData') + path.sep + userLogsPath + path.sep + logFile + '.json')
    let logDB = new Store({name: getCurrentDate()})
    let log = logDB.get('log')
    global.availableLog = {date: stats.mtime, content: log}
    win.webContents.send('logReady')
}

// set the active project based on a project ID
function setActiveProject(projectID) {
    let index = getDbIndex(projectID)
    global.activeProject = global.availableProjects[index]
}

// create a project
function newProject(event, project) {
    let newProject = project
    newProject.id = global.availableProjects.index + 1
    newProject.totalFunds = 0
    newProject.address = {}
    
    let addressPair = smartapi.generateAddresses()
    newProject.address.publicKey = addressPair.publicKey
    newProject.address.privateKey = addressPair.privateKey
    
    global.availableProjects.index = global.availableProjects.index + 1
    global.availableProjects.list.push(newProject)
    db.set('projects', global.availableProjects)
    
    logger.info('Project "' + newProject.name + '" was created.')
    refreshLogFile()
    event.sender.send('newProjectAdded')
    win.webContents.send('projectsReady')
}

// automatically sweep project funds if sweep date has expired
function autoSweepFunds() {
    /*global.availableProjects.list.forEach(function(project, projectKey) {
        project.recvAddrs.forEach(function(address, addrKey) {
            
        })
    })*/
    
    logger.info('Funds were automatically swept for project "' + global.activeProject.name + '".')
    refreshLogFile()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    // app config
    ipcMain.setMaxListeners(0);    
    
    // setup logging
    logFile = getCurrentDate()
    
    logger = createLogger({
        //level: 'error',
        format: combine(timestamp(), prettyPrint()),
        transports: [
            new module.exports.JsonDBTransport({ filename: sysLogsPath + path.sep + logFile, level: 'error' }),
            new module.exports.JsonDBTransport({ filename: userLogsPath + path.sep + logFile, level: 'info' })
        ],
        exitOnError: false
    })
    logger.emitErrs = false
    
    // load the project db or create it if it doesn't exist
    // saved in %APPDATA%/smart-sweeper on Win
    // saved in $XDG_CONFIG_HOME/smart-sweeper or ~/.config/smart-sweeper on Linux
    // saved in ~/Library/Application Support/smart-sweeper on Mac
    db = new Store({name: "smart-sweeper"})
    global.availableProjects = db.get('projects')    
    if (global.availableProjects === undefined) {
        db.set('projects', {index: 0, list: []})
        global.availableProjects = db.get('projects')
        
        // automatically sweep funds if necessary
        //sweepFunds()
    }
    
    global.referrer = ""
    
    createWindow()
    
    // extras for dev mode
    if (isDev) {
        const elemon = require('elemon')
        elemon({
            app: app,
            mainFile: 'index.js',
            bws: [
              {bw: win, res: []}
            ]
        })
        
        logger.add(new transports.Console({format: format.simple()}))
    }
})

// quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
        win.maximize()
    }
})

// set which function opened a modal/dialog
ipcMain.on('setReferrer', (event, args) => {
    global.referrer = args.referrer
})

// get the total amount of gift funds that have been claimed
ipcMain.on('getClaimedFundsInfo', (event, args) => {
    let totalAddrs = 0
    let callbackCounter = 0
    let claimedFunds = 0
    let claimedWallets = 0
    
    function callback(resp, addrAmt) {        
        if (resp.type === "data" && parseInt(resp.msg) == 0) {
            claimedFunds += addrAmt
            claimedWallets++
        }
        else if (resp.type === "error") {
            logger.error('getClaimedFundsInfo: ' + resp.msg)
        }
        
        callbackCounter++
        
        if (callbackCounter == totalAddrs)
            event.sender.send('claimedFundsInfo', {claimedFunds: claimedFunds, claimedWallets: claimedWallets})
    }
    
    if (args === undefined) {
        global.availableProjects.list.forEach(function(project, projectKey) {
            project.recvAddrs.forEach(function(address, addrKey) {
                smartapi.checkBalance(address.publicKey, project.addrAmt, callback)
                totalAddrs++
            })
        })
    }
    else {
        let index = getDbIndex(args.projectID)
        let project  = global.availableProjects.list[index]
        
        project.recvAddrs.forEach(function(address, addrKey) {
            smartapi.checkBalance(address.publicKey, project.addrAmt, callback)
            totalAddrs++
        })
    }
})

// get the total amount of transactions that have yet to be confirmed
ipcMain.on('getPendingFundsInfo', (event, args) => {
    let totalAddrs = 0
    let callbackCounter = 0
    let pendingWallets = 0
    let pendingFunds = 0
    
    function callback(resp, addrAmt) {
        console.log(resp)
        
        if (resp.type === "data" && resp.msg < 6) {
            pendingFunds += addrAmt
            pendingWallets++
        }
        else if (resp.type === "error") {
            logger.error('getPendingFundsInfo: ' + resp.msg)
        }
        
        callbackCounter++
        
        if (callbackCounter == totalAddrs)
            event.sender.send('pendingFundsInfo', {pendingFunds: pendingFunds, pendingWallets: pendingWallets})
    }
    
    global.availableProjects.list.forEach(function(project, projectKey) {
        project.recvAddrs.forEach(function(address, addrKey) {
            if (address.txid !== undefined) {
                smartapi.checkTransaction(address.txid, project.addrAmt, callback)
                totalAddrs++
            }
        })
    })
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
                smartapi.checkTransaction(address.txid, project.addrAmt, callback)
                totalAddrs++
            }
        })
    })
})

// get the current balance of a project address
ipcMain.on('checkProjectBalance', (event, args) => {
    
})

// load a confirmation dialog
ipcMain.on('showConfirmationDialog', (event, text) => {    
    if (modal === undefined || modal == null)
        createDialog(event, win, 'question', text)
    else
        createDialog(event, modal, 'question', text)
})

// load an info dialog
ipcMain.on('showInfoDialog', (event, text) => {    
    if (modal === undefined || modal == null)
        createDialog(event, win, 'info', text)
    else
        createDialog(event, modal, 'info', text)
})

// modal "cancel"
ipcMain.on('modalNo', (event, args) => {
    global.activeProject = null
    modal.close()
    win.webContents.send('modalNo')
})

// create a project
ipcMain.on('newProject', (event, args) => {
    newProject(event, args.newProject)
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
    win.webContents.send('projectsReady')
})

// delete a project
ipcMain.on('deleteProject', (event, args) => {
    let index = getDbIndex(args.id)
    let name = global.availableProjects[index].name
    global.availableProjects.list.splice(index, 1)
    db.set('projects', global.availableProjects)
    logger.info('Project "' + name + '" was deleted.')
    refreshLogFile()
    win.webContents.send('projectsReady')
})

// get all projects
ipcMain.on('getProjects', (event, args) => {
    global.availableProjects = db.get('projects')
    win.webContents.send('projectsReady')
})

// load a modal to edit a project
ipcMain.on('editProject', (event, args) => {
    modalType = "edit"
    global.activeProject = args.project
    createModal('edit')
})

// update a project edited in the modal
ipcMain.on('updateProject', (event, args) => {
    modal.close()
    let index = getDbIndex(global.activeProject.id)
    global.availableProjects.list[index] = global.activeProject
    db.set('projects', global.availableProjects)
    logger.info('Project "' + global.activeProject.name + '" was edited.');
    refreshLogFile()
    global.activeProject = null
    win.webContents.send('projectsReady')
})

// send funds to a project
ipcMain.on('fundProject', (event, args) => {
    // create and broadcast the transaction    
    // calculate and save the amount per address
    
    logger.info('Project "' + global.activeProject.name + '" was funded.')
    refreshLogFile()
})

// show a print dialog for the wallets modal
ipcMain.on('showPrintDialog', (event, args) => {
    modal.webContents.print({printBackground: true})
})

// send funds to receiver addresses
ipcMain.on('sendFunds', (event, args) => {
    
    //txid
    // one message per receiver address (project - address - txid)
    
    //logger.info('Funds were send to wallets for project "' + global.activeProject.name + '".')
    
    refreshLogFile()
})

// create paper wallets
ipcMain.on('createPaperWallets', (event, args) => {   
    let index = getDbIndex(args.projectID)
    global.activeProject = global.availableProjects.list[index]
    modalType = "paperWallets"
    createModal('paperWallets')
    
    //logger.info('Paper wallets for project ' + global.activeProject.name + ' were created.')
    //refreshLogFile()
})

// manually sweep project funds
ipcMain.on('sweepFunds', (event, projectID) => {
    let index = getDbIndex(projectID)
    let project = global.availableProjects.list[index]
    
    /*project.recvAddrs.forEach(function(addr, addrKey) {
        smartapi.sweepFunds({sender: addr, receiver: project.publicKey})
    })*/
    
    logger.info('Funds were manually swept for project "' + global.activeProject.name + '".')
    refreshLogFile()
})

// load the most recent log file
ipcMain.on('loadLog', (event, args) => {
    let logPath = app.getPath('userData') + path.sep + userLogsPath + path.sep
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
    
    logFile = userLogsPath + path.sep + path.parse(mostRecent.file).name
    
    let logDB = new Store({name: logFile})
    let log = logDB.get('log')
    global.availableLog = {date: mostRecent.lastModified, content: log}
    event.sender.send('logReady')
})

// open the log folder
ipcMain.on('openLogFolder', (event, args) => {
    shell.showItemInFolder(app.getPath('userData') + path.sep + logFile + '.json')
})