const packager = require('electron-packager')

var options = {
    dir: "C:\\Abyss Web Server\\htdocs\\smart-sweeper\\",
    ignore: [
        "[\/\\]smart-sweeper[\/\\](.)+\.zip",
        "[\/\\]smart-sweeper[\/\\](.)+\.txt",
        "[\/\\]smart-sweeper[\/\\](.)+\.pdf",
        "[\/\\]smart-sweeper[\/\\](.)+\.log",
        "[\/\\]smart-sweeper[\/\\]dist",
        "[\/\\]smart-sweeper[\/\\]rpc-explorer",
        "[\/\\]smart-sweeper[\/\\]startbootstrap-sb-admin-3.3.7",
        "[\/\\]smart-sweeper[\/\\]packager.js"
    ],
    //asar: true,
    overwrite: true
};

packager(options)
.then(appPaths => { 
    console.log(appPaths);
});