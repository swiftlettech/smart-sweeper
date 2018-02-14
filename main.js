const electron = require('electron');
const {app, ipcMain, BrowserWindow} = electron;
const path = require('path');
const url = require('url');
const Store = require('electron-store');
const isDev = require('electron-is-dev');
require('electron-debug')({showDevTools: true});

let win, modal, db, projects;

function createWindow () {
    const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize;
    
    // Create the browser window.
    win = new BrowserWindow({
        width: width,
        height: height,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    
    win.setMenu(null);

    // and load the index.html of the app.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createWindow();
    
    // only load these modules if in dev mode
    if (isDev) {
        const elemon = require('elemon');
        elemon({
            app: app,
            mainFile: 'main.js',
            bws: [
              {bw: win, res: []}
            ]
        });
    };
    
    // create the db if it doesn't already exist
    db = new Store({name: "smart-sweeper"});
    
    projects = db.get("projects");    
    if (projects === undefined) {
        db.set("projects", {index: 0, list: [] });
        global.availableProjects = db.get("projects");
    }
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow();
        win.maximize();
    }
});

// create a project
ipcMain.on('newProject', (event, args) => {
    event.preventDefault();
    
    var newProject = args.newProject;
    newProject.id = global.availableProjects.index + 1;
    global.availableProjects.index = global.availableProjects.index + 1;
    global.availableProjects.list.push(newProject);
    db.set("projects", global.availableProjects);
    
    event.sender.send('newProjectAdded');
    event.sender.send('projectsReady');
});

// delete a project
ipcMain.on('deleteProject', (event, args) => {
    args.id;
    //event.sender.send('projectsReady', projects);
});

// get all projects
ipcMain.on('getProjects', (event, args) => {
    global.availableProjects = db.get("projects");
    event.sender.send('projectsReady');
});

// edit a project
ipcMain.on('editProject', (event, args) => {
    //args.id;
    
    global.activeProject = args.project;
    
    winBounds = win.getBounds();
    
    modal = new BrowserWindow({
        width: Math.ceil(winBounds.width - (winBounds.width*0.4)),
        height: winBounds.height,
        parent: win,
        modal: true,
        show: false
    });
    
    modal.loadURL(url.format({
        pathname: path.join(__dirname, '/app/send/editModal.html'),
        protocol: 'file:',
        slashes: true
    }));
    
    modal.once('ready-to-show', () => {
        modal.show();
    });
    
    modal.on('closed', () => {
        modal = null;
    });
});