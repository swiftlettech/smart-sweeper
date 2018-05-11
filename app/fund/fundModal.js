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
            
            ctrl.showTxEntry = false;
            ctrl.showFundForm = false;
            
            $document.find('#page-wrapper').css('height', function() {
                var height = window.innerHeight - parseInt($document.find('body').css('margin-top'))*2;
                return height + 'px';
            });
        };        

        /* Close the modal without funding the project. */
        ctrl.cancel = function() {
            ipcRenderer.send('modalNo');
        };
        
        /* Send funding information back to the main process. */
        ctrl.fundInfo = function(form) {            
            ipcRenderer.on('dialogNo', (event, args) => {
                if (electron.remote.getGlobal('referrer') !== "fundProjectModal")
                    return;
            });

            ipcRenderer.on('dialogYes', (event, args) => {
                if (electron.remote.getGlobal('referrer') !== "fundProjectModal")
                    return;
                
                ipcRenderer.send('fundProject', {projectID: ctrl.activeProject.id, projectName: ctrl.activeProject.name, amount: parseFloat(ctrl.originalFunds), toAddr: ctrl.activeProject.addressPair.publicKey, fromAddr: ctrl.fundingAddr, fromPK: ctrl.fundingPK});
                
                ipcRenderer.on('projectFunded', (event, args) => {
                    $scope.$apply(function() {
                        ctrl.txSuccessful = args.txSuccessful;
                        
                        ctrl.activeProject = null;
                        form.$setPristine();
                        form.$setUntouched();
                        form.$submitted = false;
                    });
                });
            });
            
            if (form.$valid) {
                ipcRenderer.send('setReferrer', {referrer: 'fundProjectModal'});
                ipcRenderer.send('showConfirmationDialog', {title: 'Fund project "' + ctrl.activeProject.name + '"?', body: 'Are you sure you want to fund this project?'});
            }
        };
        
        /* Updates project with information from an external transaction id. */
        ctrl.projectTx = function(form) {
            ipcRenderer.send('setReferrer', {referrer: 'fundProjectModal'});
            ipcRenderer.send('checkFundingTxid', {projectID: ctrl.activeProject.id, projectName: ctrl.activeProject.name, address: ctrl.activeProject.addressPair.publicKey, txid: form.txid.$viewValue});
            
            ipcRenderer.on('fundingTxidChecked', (event, args) => {
                $scope.$apply(function() {
                    ctrl.validTx = args.validTx;
                    ctrl.msg = args.msg;
                });
            });
        };
        
        /* Show/hide a funding form. */
        ctrl.showForm = function(btn) {            
            if (btn === "txidEntry") {
                ctrl.showTxEntry = !ctrl.showTxEntry;
                ctrl.showFundForm = false;
                $document.find('#projectTxForm').removeClass('hide');
            }
            else if (btn === "fundProject") {
                ctrl.showFundForm = !ctrl.showFundForm;
                ctrl.showTxEntry = false;
                $document.find('#fundProjectForm').removeClass('hide');
            }
        };
    }
})();