(function() {
    'use strict';

    angular.module('SmartSweeper.fundModal', [
        'SmartSweeperUtils',
        'ui.bootstrap'
    ])
    .controller('FundProjectController', FundProjectController);

    function FundProjectController($scope, $document, greaterThanZeroIntPattern) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        
        var ctrl = this;

        $scope.init = function() {
            ctrl.greaterThanZeroIntPattern = greaterThanZeroIntPattern;
            ctrl.originalFunds = 0;            
            ctrl.activeProject = electron.remote.getGlobal('activeProject');
        };        

        /* Close the modal without funding the project. */
        ctrl.cancel = function() {
            ipcRenderer.send('modalNo');
        };
        
        /* Send funding information back to the main process. */
        ctrl.fundInfo = function(form) {            
            ipcRenderer.on('dialogNo', (event, arg) => {
                if (electron.remote.getGlobal('referrer') !== "fundProjectModal")
                    return;
            });

            ipcRenderer.on('dialogYes', (event, arg) => {
                if (electron.remote.getGlobal('referrer') !== "fundProjectModal")
                    return;
                
                ipcRenderer.send('fundProject', {projectID: ctrl.activeProject.id, originalFunds: parseFloat(ctrl.originalFunds), projectAddr: ctrl.activeProject.addressPair.publicKey, sourceAddr: ctrl.fundingAddr, sourcePK: ctrl.fundingPK});
                
                ctrl.activeProject = null;
                form.$setPristine();
                form.$setUntouched();
                form.$submitted = false;
            });
            
            if (form.$valid) {
                ipcRenderer.send('setReferrer', {referrer: 'fundProjectModal'});
                ipcRenderer.send('showConfirmationDialog', {title: 'Fund project "' + ctrl.activeProject.name + '"?', body: 'Are you sure you want to fund this project?'});
            }
        };
    }
})();