(function() {
    'use strict';

    angular.module('SmartSweeper.edit', [
        'SmartSweeperUtils',
        'ui.bootstrap'
    ])
    .controller('EditController', EditController);

    function EditController($rootScope, $scope, $document, $filter, alertservice, uibDateParser) {
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
            
            /*$rootScope.$watch('formAlerts', function(newValue, oldValue, scope) {
                console.log(oldValue);
                console.log(newValue);
                
                if (newValue !== oldValue)
                    ctrl.formAlerts = newValue;
            });*/
        };        

        ctrl.cancel = function() {
            ipcRenderer.send('modalNo');
        };
        
        ctrl.closeAlert = function(index) {
            ctrl.formAlerts.splice(index, 1);
        };
        
        ctrl.createAddresses = function(form) {
            // disable the create addresses button
            $document.find('#editProjectForm #createAddrBtn').attr('disabled', 'disabled');
            
            ipcRenderer.on('dialogNo', (event, arg) => {
                if (electron.remote.getGlobal('referrer') !== "createAddressesEdit")
                    return;

                $document.find('#editProjectForm #createAddrBtn').removeAttr('disabled');
            });

            ipcRenderer.on('dialogYes', (event, arg) => {
                if (electron.remote.getGlobal('referrer') !== "createAddressesEdit")
                    return;
                
                ctrl.activeProject = electron.remote.getGlobal('activeProject');
                
                if (ctrl.activeProject.recvAddrs.length == 0) {
                    // create the addresses and add them to the project
                    ipcRenderer.send('createRecvAddresses', {project: ctrl.activeProject, newProjectFlag: false});
                    ipcRenderer.on('addressesCreated', (event, arg) => {
                        ctrl.formAlerts = alertservice.createAlert('formAlert', 'success', 'Addresses created.');
                    });
                }
            });
            
            if (form.$valid) {
                ipcRenderer.send('setReferrer', {referrer: 'createAddressesEdit'});
                ipcRenderer.send('showConfirmation', {title: 'Create receiver addresses?', body: 'Are you sure you want to create receiver addresses for this project?'});
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