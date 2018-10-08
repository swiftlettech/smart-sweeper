const packager = require('electron-packager');
const fs = require('fs');
const path = require('path');

var options = {
    dir: "C:\\Abyss Web Server\\htdocs\\smart-sweeper\\",
    ignore: [
        "^/.+[^/]+\.zip$",
        "^/.+[^/]+\.txt$",
        "^/.+[^/]+\.pdf$",
        //"^/.+[^/]+\.log$",
        "^/.+[^/]+\.jpg",
        //"^/config($|/)",
        "^/dist($|/)",
        "^/startbootstrap-sb-admin-3.3.7($|/)",
        "^/packager\.js$"
    ],
    /*afterCopy: [(buildPath, electronVersion, platform, arch, callback) => {
        // copy the config folder into the new root folder
        fs.copyFileSync('config' + path.sep + 'development.json', buildPath + path.sep + 'config' + path.sep + 'development.json');
        
        //console.log(buildPath);
        
        callback()
    }],*/
    //asar: true,
    overwrite: true
};

packager(options)
.then(appPaths => { 
    console.log(appPaths);
});