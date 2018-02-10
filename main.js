const electron = require('electron');
const {app, ipcMain, BrowserWindow} = electron;
const path = require('path');
const url = require('url');
const isDev = require('electron-is-dev');
require('electron-debug')({showDevTools: true});

const jsonDB = require('node-json-db');
const autoSave = true;
const humanReadable = true;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win, modal, db;

function createWindow () {
    const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize;
    
    // Create the browser window.
    win = new BrowserWindow({
        width: width,
        height: height,
        webPreferences: {
            //nodeIntegration: false,
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
    }
    
    // create the db if it doesn't already exist
    db = new jsonDB("db/smart-sweeper", autoSave, humanReadable);
    var projects;
    
    try {
        projects = db.getData("/projects");
    }
    catch (error) {
        console.log(error);
        db.push("/projects", {index: 0, list:[] } );
        projects = db.getData("/projects");
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
    var newProject = args.newProject;
    newProject.id = projects.index + 1;
    projects.index = projects.index + 1;
    projects.list.push(newProject);
    db.push("/projects", projects);
    db.reload();
    projects = db.getData("/projects");
    
    event.sender.send('newProjectAdded');
    event.sender.send('projectsReady', projects);
});

// delete a project
ipcMain.on('deleteProject', (event, args) => {
    args.id;
    //event.sender.send('projectsReady', projects);
});

// get all projects
ipcMain.on('getProjects', (event, args) => {
    projects = db.getData("/projects");    
    event.sender.send('projectsReady', projects);
});

// edit a project
ipcMain.on('editProject', (event, args) => {
    args.id;
    args.project;
    
    modal = new BrowserWindow({
        //width: ,
        //height: ,
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