(function() {
    'use strict';

    const {ipcRenderer} = require('electron');
    
    ipcRenderer.on('setModalText', (event, message) => {
        $('.body').html(message);
    });

    $('#cancelBtn').on('click', function() {
        ipcRenderer.send('modalNo');
    });

    $('#okBtn').on('click', function() {
        ipcRenderer.send('modalYes');
    });
})();