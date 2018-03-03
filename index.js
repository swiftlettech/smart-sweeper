/* Main app logic. */
const electron = require('electron')
const {app, ipcMain, BrowserWindow} = electron
const path = require('path')
const url = require('url')
const Store = require('electron-store')
const isDev = require('electron-is-dev')
require('electron-debug')({showDevTools: true})

let win, modals, modalType, db, projects, smartapi

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
    var parent
    var modal
    var title
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
        title = "Edit Project"
        parent = win
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
        title = "Confirmation"
        modals.length > 0 ? parent = modals[modals.length-1] : parent = win
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
        modal.webContents.send('setModalText', text)
        modal.show()
    })
    
    modal.on('closed', () => {
        modal = null
    })
    
    modals.push(modal)
}

// create the receiver addresses for a project
function createRecvAddresses(project) {
    for (var i=0; i<project.numAddr; i++) {
        addressPair = smartapi.generateAddress()        
        project.recvAddrs.push(addressPair)
        //{publicKey: addressPair.publicKey, privateKey: addressPair.privateKey}
    }
    
    var index = getDbIndex(project.id)
    global.availableProjects.list[index] = project
    db.set("projects", global.availableProjects)
}

// return the index of a project in the database
function getDbIndex(projectID) {
    var arrayIndex;
    
    global.availableProjects.list.forEach(function(project, index) {
        if (project.id == projectID)
            arrayIndex = index
    })
    
    return arrayIndex;
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
    global.referrer = ""
    modals = []
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

// set which function opened a modal
ipcMain.on('setReferrer', (event, args) => {
    global.referrer = args.referrer
})

// load a confirmation modal
ipcMain.on('showConfirmation', (event, text) => {
    modalType = "confirmation"
    createModal('confirmation', text)
})

// confirmation modal "yes"
ipcMain.on('modalYes', (event, args) => {
    console.log('modalYes');
    modals.pop().close()
    
    if (modals.length > 0)
        modals[modals.length-1].webContents.send('modalYes')
    else
        win.webContents.send('modalYes')
})

// confirmation modal "no" and regular modal "cancel"
ipcMain.on('modalNo', (event, args) => {
    if (modalType.indexOf('confirmation') == -1)
        global.activeProject = null;
    
    modals.pop().close()
    
    /*if (modals.length > 0) {
        modals[modals.length-1].webContents.send('modalNo')
    }
    else*/
        win.webContents.send('modalNo')
})

// create a project
ipcMain.on('newProject', (event, args) => {
    var newProject = args.newProject
    newProject.id = global.availableProjects.index + 1
    newProject.totalFunds = 0
    newProject.address = {}
    newProject.recvAddrs = []
    
    var addressPair = smartapi.generateAddress()
    newProject.address.publicKey = addressPair.publicKey
    newProject.address.privateKey = addressPair.privateKey
    
    global.availableProjects.index = global.availableProjects.index + 1
    global.availableProjects.list.push(newProject)
    db.set("projects", global.availableProjects)
    
    createRecvAddresses(newProject);
    
    event.sender.send('newProjectAdded')
    win.webContents.send('projectsReady')
})

// create the sender addresses for a project
ipcMain.on('createRecvAddresses', (event, args) => {    
    createRecvAddresses(args.activeProject)
    
    event.sender.send('addressesCreated')
    win.webContents.send('projectsReady')
})

// delete a project
ipcMain.on('deleteProject', (event, args) => {
    var index = getDbIndex(args.id)
    global.availableProjects.list.splice(index, 1)
    db.set("projects", global.availableProjects)
    win.webContents.send('projectsReady')
})

// get all projects
ipcMain.on('getProjects', (event, args) => {
    global.availableProjects = db.get("projects")
    win.webContents.send('projectsReady')
})

// load a modal to edit a project
ipcMain.on('editProject', (event, args) => {
    modalType = "edit"
    global.activeProject = args.project
    createModal('edit')
})

// update a project
ipcMain.on('updateProject', (event, args) => {
    modals.pop().close()
    var index = getDbIndex(global.activeProject.id)
    global.availableProjects.list[index] = global.activeProject
    db.set("projects", global.availableProjects)
    win.webContents.send('projectsReady')
})

// send funds to a project
ipcMain.on('fundProject', (event, args) => {
    
})