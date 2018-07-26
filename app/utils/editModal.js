(function() {
    'use strict';

    angular.module('SmartSweeper.edit', [
        'SmartSweeperUtils',
        'ui.bootstrap'
    ])
    .controller('EditController', EditController);

    function EditController($scope, $document, greaterThanZeroIntPattern) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        
        var ctrl = this;

        $scope.init = function() {
            ctrl.greaterThanZeroIntPattern = greaterThanZeroIntPattern;
            
            ctrl.activeProject = electron.remote.getGlobal('activeProject');
            ctrl.expDate = new Date(ctrl.activeProject.expDate);
            //ctrl.sweepDate = new Date(ctrl.activeProject.sweepDate);
            ctrl.sweepDate = ""; // auto-sweep hasn't been implemented, use an empty string to prevent a form validation error
            
            ctrl.updateAddrAmt();
            console.log("activeProject");
            console.log(ctrl.activeProject);
            
            ctrl.expCalendar = {
                opened: false
            };
            ctrl.sweepCalendar = {
                opened: false
            };
            ctrl.datepickerOptions = {
                showWeeks: false
            };
            ctrl.datepickerFormat = "MM/dd/yyyy";
        };        

        /* Close the modal without updating the project. */
        ctrl.cancel = function() {
            ipcRenderer.send('modalNo');
        };
        
        /* Is the calendar date in the future? */
        ctrl.checkCalendarDate = function(type) {
            var today = new Date();
            var input;
            var value;
            
            if (type === "expCalendar") {
                input = $scope.editProjectForm.expDate;
                value = ctrl.expDate;
            }
            else if (type === "sweepCalendar") {
                input = $scope.editProjectForm.sweepDate;
                value = ctrl.sweepDate;
            }
            
            if (value > today)
                input.$setValidity('invalidDate', true);
            else
                input.$setValidity('invalidDate', false);
        };
        
        /* Create sender addresses for a project. */
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
                
                if (ctrl.activeProject.recvAddrs === undefined || ctrl.activeProject.recvAddrs.length == 0) {
                    // create the addresses and add them to the project
                    ipcRenderer.send('createRecvAddresses', {project: ctrl.activeProject, newProjectFlag: false});
                    ipcRenderer.on('addressesCreated', (event, arg) => {
                        form.$submitted = true;
                        ipcRenderer.send('showInfoDialog', {title: 'Receiver addresses', body: 'Addresses were created successfully.'});
                        ctrl.addressesCreated = true;
                    });
                }
            });
            
            if (form.$valid) {
                ipcRenderer.send('setReferrer', {referrer: 'createAddressesEdit'});
                ipcRenderer.send('showConfirmationDialog', {title: 'Create receiver addresses?', body: 'Are you sure you want to create receiver addresses for this project?'});
            }
        };
        
        /* Open the calendar popup. */
        ctrl.openCalendar = function(type) {
            if (type === "expCalendar")
                ctrl.expCalendar.opened = true;
            else if (type == "sweepCalendar")
                ctrl.sweepCalendar.opened = true;
        };
        
        /* Update the project. */
        ctrl.update = function(form) {
            ctrl.activeProject.numAddr = parseInt(ctrl.activeProject.numAddr);
            ctrl.activeProject.expDate = ctrl.expDate;
            ctrl.activeProject.sweepDate = ctrl.sweepDate;
            
            ipcRenderer.send('updateProject', {activeProject: ctrl.activeProject});
            ipcRenderer.on('projectUpdated', (event, arg) => {
                ctrl.activeProject = null;
                form.$setPristine();
                form.$setUntouched();
                form.$submitted = false;
            });
        };
        
        /* Calculate the amount of SMART to send to each receiving address. */
        ctrl.updateAddrAmt = function() {
            if (ctrl.activeProject.originalFunds > 0)
                ctrl.activeProject.addrAmt = (ctrl.activeProject.originalFunds - electron.remote.getGlobal('sharedObject').txFee) / ctrl.activeProject.numAddr;
            else
                ctrl.activeProject.addrAmt = 0;
        };
    }
})();