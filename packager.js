const packager = require('electron-packager')

var options = {
    dir: "C:\\Abyss Web Server\\htdocs\\smart-sweeper\\",
    ignore: [
        "^(.)+\.zip",
        "^(.)+\.txt",
        "^(.)+\.pdf",
        "^(.)+\.log",
        "dist",
        "rpc-explorer",
        "startbootstrap-sb-admin-3.3.7",
        "packager.js"
    ],
    asar: true,
    overwrite: true
};

packager(options)
.then(appPaths => { 
    console.log(appPaths);
});