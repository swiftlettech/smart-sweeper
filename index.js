/* Main app logic. */
const electron = require('electron')
const {app, ipcMain, BrowserWindow} = electron
const path = require('path')
const url = require('url')
const Store = require('electron-store')
const isDev = require('electron-is-dev')
require('electron-debug')({showDevTools: true})

let win, modal, db, projects, smartapi, referrer

// create the main window
function createWindow () {
    const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize
    
    // Create the browser window.
    win = new BrowserWindow({
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
    var width
    var height
    var pathname
    var resizable
    var minimizable
    var maximizable
    var alwaysOnTop
    var fullscreenable
    
    winBounds = win.getBounds()
    
    if (type === "edit") {
        //width = Math.ceil(winBounds.width - (winBounds.width*0.6)),
        //height = Math.ceil(winBounds.height - (winBounds.height*0.15))
        width = winBounds.width
        height = winBounds.height
        pathname = path.join(__dirname, '/app/create/editModal.html')
        resizable = true
        minimizable = true
        maximizable = true
        alwaysOnTop = false
        fullscreenable = true
    }
    else if (type === "confirmation") {
        width = Math.ceil(winBounds.width - (winBounds.width*0.75))
        height = Math.ceil(winBounds.height - (winBounds.height*0.75))
        pathname = path.join(__dirname, '/app/utils/confirmationModal.html')
        resizable = true
        minimizable = false
        maximizable = true
        alwaysOnTop = true
        fullscreenable = false
    }
    
    modal = new BrowserWindow({
        width: width,
        height: height,
        resizable: resizable,
        minimizable: minimizable,
        maximizable: maximizable,
        alwaysOnTop: alwaysOnTop,
        fullscreenable: fullscreenable,
        parent: win,
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
        modal.webContents.send('setModalText', text)
        modal.show()
    })
    
    modal.on('closed', () => {
        modal = null
    })
}

// return the index of a project in the database
function getDbIndex(projectID) {
    
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createWindow()
    
    // only load these modules if in dev mode
    if (isDev) {
        const elemon = require('elemon')
        elemon({
            app: app,
            mainFile: 'index.js',
            bws: [
              {bw: win, res: []}
            ]
        })
    }
    
    // load the db or create it if it doesn't already exist
    // saved in %APPDATA%/smart-sweeper on Win
    // saved in $XDG_CONFIG_HOME/smart-sweeper or ~/.config/smart-sweeper on Linux
    // saved in ~/Library/Application Support/smart-sweeper on Mac
    db = new Store({name: "smart-sweeper"})    
    global.availableProjects = db.get("projects")    
    if (global.availableProjects === undefined) {
        db.set("projects", {index: 0, list: []})
        global.availableProjects = db.get("projects")
    }
    
    smartapi = require('./smartapi')
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

// load a confirmation modal
ipcMain.on('loadConfirmation', (event, text) => {
    createModal('confirmation', text)
})

// confirmation modal "yes"
ipcMain.on('modalYes', (event, args) => {
    modal.close()
    win.webContents.send('modalYes')
})

// confirmation modal "no"
ipcMain.on('modalNo', (event, args) => {
    modal.close()
    win.webContents.send('modalNo')
})

// create a project
ipcMain.on('newProject', (event, args) => {
    var newProject = args.newProject
    newProject.id = global.availableProjects.index + 1
    newProject.address = {}
    newProject.recvAddrs = {}
    
    var addressPair = smartapi.generateAddress()
    newProject.address.publicKey = addressPair.publicKey
    newProject.address.privateKey = addressPair.privateKey
    
    global.availableProjects.index = global.availableProjects.index + 1
    global.availableProjects.list.push(newProject)
    db.set("projects", global.availableProjects)
    
    event.sender.send('newProjectAdded')
    event.sender.send('projectsReady')
})

// create the sender addresses for a project
ipcMain.on('createSenderAddresses', (event, args) => {    
    /*var activeProject = args.activeProject
    var addressPair;
    
    for (var i=0 i<activeProject.numAddr i++) {
        addressPair = smartapi.generateAddress()        
        activeProject.recvAddrs.push({publicKey: addressPair.publicKey, privateKey: addressPair.privateKey})
    }
    
    var index = getDbIndex(activeProject.id)    
    global.availableProjects.list[index] = activeProject
    db.set("projects", global.availableProjects)
    
    event.sender.send('addressesCreated')
    event.sender.send('projectsReady')*/
})

// delete a project
ipcMain.on('deleteProject', (event, args) => {
    var index = getDbIndex(args.id)
    global.availableProjects.list.splice(index, 1)
    db.set("projects", global.availableProjects)
    event.sender.send('projectsReady', global.availableProjects)
})

// get all projects
ipcMain.on('getProjects', (event, args) => {
    global.availableProjects = db.get("projects")
    event.sender.send('projectsReady')
})

// edit a project
ipcMain.on('editProject', (event, args) => {
    //args.id
    
    global.activeProject = args.project
    
    createModal('edit')
})

// send funds to a project
ipcMain.on('fundProject', (event, args) => {
    
})