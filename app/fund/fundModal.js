(function() {
    'use strict';

    angular.module('SmartSweeper.fundModal', [
        'ui.bootstrap',
        'SmartSweeperUtils'
    ])
    .controller('FundProjectController', FundProjectController);

    function FundProjectController($scope, $document, $interval, greaterThanZeroIntPattern) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        
        var ctrl = this;
        ctrl.activeProject = electron.remote.getGlobal('activeProject');

        $scope.init = function() {
            var clipboardjs = new ClipboardJS('.copy-btn');
            clipboardjs.on('success', function(event) {
                // select the text on clicking the copy button
                $('#projectAddress').selectText();
            });
            
            buildTxData();
            
            ctrl.greaterThanZeroIntPattern = greaterThanZeroIntPattern;
            ctrl.originalFunds = 0;
            ctrl.txFee = electron.remote.getGlobal('sharedObject').txBaseFee;
            ctrl.walletAmt = 1;
            
            ctrl.calcCollapsed = true;
            ctrl.projectTxCollapsed = true;
            
            ctrl.showTxEntry = true;
            //ctrl.showFundForm = false;
            ctrl.isOpen = [false, false];
            
            if (ctrl.activeProject.txid && ctrl.activeProject.txid.length > 0)
                ctrl.isOpen[1] = true;
            else
                ctrl.isOpen[0] = true;
            
            // reload projects when there have been changes
            ipcRenderer.on('projectsReady', (event, args) => {            
                $scope.$apply(function() {
                    getActiveProjectInfo();
                });
            });
        };
        
        function buildTxData() {
            ctrl.balance = ctrl.activeProject.originalFunds;
            var activeTxs = [];
            ctrl.activeTxs = [];

            angular.forEach(ctrl.activeProject.txid, function(tx, key) {
                var txid = Object.keys(tx)[0];
                activeTxs.push(txid);

                ctrl.activeTxs.push({
                    txid: Object.keys(tx)[0],
                    confirmations: tx[txid].confirmations,
                    confirmed: tx[txid].confirmed
                });
            });
        }
        
        function getActiveProjectInfo() {
            ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                    
            var activeProjectID = ctrl.activeProject.id;
            ctrl.availableProjects.forEach(function(project, index) {
                if (project.id == activeProjectID)
                    ctrl.activeProject = project;
            })
            
            buildTxData();
        }

        /* Close the modal without funding the project. */
        ctrl.cancel = function() {
            ipcRenderer.send('modalNo');
        };
        
        /* Send funding information back to the main process. NOT USED */
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
    
    // from: https://jsfiddle.net/edelman/KcX6A/1506/
    jQuery.fn.selectText = function(){
        var doc = document
            , element = this[0]
            , range, selection
        ;
        if (doc.body.createTextRange) {
            range = document.body.createTextRange();
            range.moveToElementText(element);
            range.select();
        } else if (window.getSelection) {
            selection = window.getSelection();        
            range = document.createRange();
            range.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    };
})();