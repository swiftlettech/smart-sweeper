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
            ctrl.activeProject.sweepDate !== "" ? ctrl.calendarDate = new Date(ctrl.activeProject.sweepDate) : ctrl.calendarDate = "";
            
            if (ctrl.activeProject.recvAddrs !== undefined && ctrl.activeProject.recvAddrs.length > 0)
                ctrl.hasRecvAddrs = true;
            else
                ctrl.hasRecvAddrs = false;
            
            ctrl.updateAddrAmt();
            console.log("activeProject");
            console.log(ctrl.activeProject);
            
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
        ctrl.checkCalendarDate = function() {
            if (ctrl.newProject.sweepDate > ctrl.today)
                $scope.addNewProjectForm.sweepDate.$setValidity('invalidDate', true);
            else
                $scope.addNewProjectForm.sweepDate.$setValidity('invalidDate', false);
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
                
                if (ctrl.activeProject.recvAddrs === undefined) {
                    // create the addresses and add them to the project
                    ipcRenderer.send('createRecvAddresses', {project: ctrl.activeProject, newProjectFlag: false});
                    ipcRenderer.on('addressesCreated', (event, arg) => {
                        form.$submitted = true;
                        ipcRenderer.send('showInfoDialog', {title: 'Receiver addresses', body: 'Addresses were created successfully.'});
                    });
                }
            });
            
            if (form.$valid) {
                ipcRenderer.send('setReferrer', {referrer: 'createAddressesEdit'});
                ipcRenderer.send('showConfirmationDialog', {title: 'Create receiver addresses?', body: 'Are you sure you want to create receiver addresses for this project?'});
            }
        };
        
        /* Update the project. */
        ctrl.update = function(form) {
            ctrl.activeProject.addrAmt = parseInt(ctrl.activeProject.addrAmt);
            ctrl.activeProject.numAddr = parseInt(ctrl.activeProject.numAddr);
            
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
                ctrl.activeProject.addrAmt = (ctrl.activeProject.originalFunds / ctrl.activeProject.numAddr).toFixed(8);
            else
                ctrl.activeProject.addrAmt = 0;
        };
    }
})();