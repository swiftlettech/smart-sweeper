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
            ctrl.txFee = 0.001;
            ctrl.walletAmt = 1;
            ctrl.activeProject = electron.remote.getGlobal('activeProject');
            
            ctrl.calcCollapsed = true;
            ctrl.projectTxCollapsed = true;
            
            ctrl.showTxEntry = true;
            //ctrl.showFundForm = false;
            
            $document.find('#page-wrapper').css('height', function() {
                var height = window.innerHeight - parseInt($document.find('body').css('margin-top'))*2;
                return height + 'px';
            });
            
            ctrl.projectTxStatus(ctrl.activeProject.addressPair.publicKey);
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
                
                ipcRenderer.send('fundProject', {projectID: ctrl.activeProject.id, projectName: ctrl.activeProject.name, amount: parseFloat(ctrl.originalFunds), toAddr: [ctrl.activeProject.addressPair.publicKey], fromAddr: ctrl.fundingAddr, fromPK: ctrl.fundingPK});
                
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
        
        /* Processes user confirmation that the project is fully funded. */
        ctrl.projectFullyFunded = function() {
            ipcRenderer.send('projectFullyFunded');
            ctrl.projectFullyFundedFlag = true;
        };
        
        /* Updates project with information from one or more external transaction ids. */
        ctrl.projectTxStatus = function() {
            ipcRenderer.send('getProjectAddressInfo', {projectID: ctrl.activeProject.id, projectName: ctrl.activeProject.name, address: ctrl.activeProject.addressPair.publicKey});
            
            ipcRenderer.on('gotAddressInfo', (event, args) => {
                $scope.$apply(function() {                    
                    ctrl.msgType = args.msgType;
                    if (ctrl.msgType === "error") {
                        ctrl.msg = args.msg;
                    }
                    else {
                        //ctrl.balance = args.balance;
                        ctrl.activeTxs = [];
                        
                        angular.forEach(args.txs, function(tx, key) {
                            if (tx.type === "vout")
                                ctrl.activeTxs.push({txid: tx.addresses});
                        });
                        
                        // check the status of each txid
                        if (ctrl.activeTxs.length > 0) {
                            ipcRenderer.send('checkFundingTxids', {projectID: ctrl.activeProject.id, projectName: ctrl.activeProject.name, address: ctrl.activeProject.addressPair.publicKey, activeTxs: ctrl.activeTxs});
                        }
                    }
                });
            });
            
            ipcRenderer.on('fundingTxidsChecked', (event, args) => {
                $scope.$apply(function() {
                    ctrl.activeProject.txConfirmed = args.confirmed;
                    ctrl.activeTxs = [];
                    
                    angular.forEach(args.txInfo, function(confirmed, key) {
                        ctrl.activeTxs.push({
                            txid: Object.keys(confirmed)[0],
                            confirmed: Object.values(confirmed)[0]
                        });
                    });
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