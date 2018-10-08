// Enable the use of 3rd party libraries in Electron.
window.nodeRequire = require;
delete window.require;
delete window.exports;
delete window.module;

const isDev = require('electron-is-dev');

if (isDev) {
    window.__devtron = {require: require, process: process};
}