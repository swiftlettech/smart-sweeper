(function() {
    'use strict';

    angular.module('SmartSweeper.edit', [
        'SmartSweeperUtils',
        'ui.bootstrap'
    ])
    .controller('EditController', EditController);

    function EditController($scope, $document, $filter, uibDateParser) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var ctrl = this;

        $scope.init = function() {
            ctrl.activeProject = electron.remote.getGlobal('activeProject');
            ctrl.activeProject.sweepDate !== "" ? ctrl.calendarDate = new Date(ctrl.activeProject.sweepDate) : ctrl.calendarDate = "";
            ctrl.activeProject.recvAddrs.length > 0 ? ctrl.hasRecvAddrs = true : ctrl.hasRecvAddrs = false;
            ctrl.updateAddrAmt();
            console.log(ctrl.activeProject);
            
            ctrl.datepickerOptions = {
                showWeeks: false
            };
            ctrl.datepickerFormat = "MM/dd/yyyy";
        };        

        ctrl.cancel = function() {
            ipcRenderer.send('modalNo');
        };
        
        ctrl.createAddresses = function(form) {
            // disable the create project button
            $document.find('#editProjectForm button[type=submit]').attr('disabled', 'disabled');
            
            if (form.$valid) {
                ipcRenderer.send('setReferrer', {referrer: 'createAddressesEdit'});
                ipcRenderer.send('showConfirmation', 'Are you sure you want to create addresses for this project?');
                
                ipcRenderer.on('modalNo', (event, arg) => {
                    if (electron.remote.getGlobal('referrer') !== 'createAddressesEdit')
                        return;

                    $document.find('#editProjectForm button[type=submit]').removeAttr('disabled');
                });

                ipcRenderer.on('modalYes', (event, arg) => {
                    console.log('modal yes in create addresses');
                    
                    if (electron.remote.getGlobal('referrer') !== 'createAddressesEdit')
                        return;

                    // create the addresses and add them to the project
                    /*ipcRenderer.send('createRecvAddresses', {activeProject: ctrl.activeProject});
                    ipcRenderer.on('addressesCreated', (event, arg) => {
                        $scope.$parent.setAppAlert('formAlert', 'success', 'Addresses created.');
                    });*/
                });
            }
        };
        
        ctrl.update = function(form) {
            ctrl.activeProject.addrAmt = parseInt(ctrl.activeProject.addrAmt);
            ctrl.activeProject.numAddr = parseInt(ctrl.activeProject.numAddr);
            
            ipcRenderer.send('updateProject');
            ipcRenderer.on('projectUpdated', (event, arg) => {
                ctrl.activeProject = null;
                form.$setPristine();
                form.$setUntouched();
                form.$submitted = false;
            });
        };
        
        ctrl.updateAddrAmt = function() {
            if (ctrl.activeProject.totalFunds > 0)
                ctrl.activeProject.addrAmt = (ctrl.activeProject.totalFunds / ctrl.activeProject.numAddr).toFixed(8);
            else
                ctrl.activeProject.addrAmt = (0).toFixed(8);
        };
        
        //TODO: paper wallet generator
        //TODO: QR code generator
        //TODO: add wallet instructions
    }
})();