(function() {
    'use strict';

    angular.module('SmartSweeper.edit', []).controller('EditController', EditController);

    function EditController($scope, $document, $filter) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var ctrl = this;

        $scope.init = function() {
            ctrl.activeProject = electron.remote.getGlobal('activeProject');
            ctrl.activeProject.recvAddrs.length > 0 ? ctrl.hasRecvAddrs = true : ctrl.hasRecvAddrs = false;
            console.log(ctrl.activeProject);
            
            ctrl.datepickerOptions = {
                showWeeks: false
            };
            ctrl.datepickerFormat = "MM/dd/yyyy";
        };

        ctrl.cancel = function() {
            console.log('modal cancel');
        };
        
        ctrl.update = function(form) {
            ctrl.activeProject.addrAmt = parseInt(ctrl.activeProject.addrAmt);
            ctrl.activeProject.numAddr = parseInt(ctrl.activeProject.numAddr);
            
            console.log('modal update');
            
            /*ipcRenderer.send('updateProject', {activeProject: ctrl.activeProject});
            ipcRenderer.on('projectUpdated', (event, arg) => {                
                ctrl.newProject = {};
                form.$setPristine();
                form.$setUntouched();
                form.$submitted = false;
            });*/
        };
        
        //TODO: paper wallet generator
        //TODO: QR code generator
        //TODO: add wallet instructions
    }
})();