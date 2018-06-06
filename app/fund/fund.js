(function() {
    'use strict';

    angular.module('SmartSweeper.fund', []).controller('FundController', FundController);

    function FundController($scope, $document, $filter, filterCompare) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {
            $mainCtrl.nameSortFlag = 1;
            $mainCtrl.totalFundsSortFlag = 1;
            $mainCtrl.addrAmtSortFlag = 1;
            $mainCtrl.sweepDateSortFlag = 1;
            ctrl.txFee = electron.remote.getGlobal('sharedObject').txFee;
            
            // load all projects
            if (angular.isArray(electron.remote.getGlobal('availableProjects').list))
                ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
            
            $mainCtrl.setPageHeight();          
        };
        
        // reload projects when there have been changes
        ipcRenderer.on('projectsReady', (event, args) => {            
            $scope.$apply(function() {
                ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                // display the project list as 10 per page?
                $mainCtrl.setPageHeight();
            });
        });
        
        /* Load a modal used to edit a project. */
        ctrl.edit = function(id) {
            ctrl.activeProjectID = id;
            ctrl.activeProject = $filter('filter')(ctrl.availableProjects, {id: id}, filterCompare)[0];
            
            ipcRenderer.send('setReferrer', {referrer: 'fundPage'});
            ipcRenderer.send('editProject', {project: ctrl.activeProject});
        };

        // transfer money to the project address
        ctrl.fundProject = function(project) {
            ipcRenderer.send('showFundModal', {project: project});
        };
        
        // create paper wallets for a project
        ctrl.createPaperWallets = function(projectID) {
            ipcRenderer.send('createPaperWallets', {projectID: projectID});
        };
        
        // transfer money from the project address to the receiver wallets
        ctrl.sendFunds = function(project) {
            ipcRenderer.send('setReferrer', {referrer: 'sendPromotionalFunds'});
            ipcRenderer.send('showConfirmationDialog', {title: 'Send funds to promotional wallets?', body: 'Are you sure you want to send funds to the promotional wallets?'});
            
            ipcRenderer.on('dialogYes', (event, arg) => {
                if (electron.remote.getGlobal('referrer') !== "sendPromotionalFunds")
                    return;
                
                console.log('in dialogYes')
                
                ipcRenderer.send('sendPromotionalFunds', {projectID: project.id, originalFunds: project.originalFunds, fromAddr: project.addressPair.publicKey, fromPK: project.addressPair.privateKey, wallets: project.recvAddrs});
            });
        };
        
        ipcRenderer.on('promotionalFundsSent', (event, args) => {
            $scope.$apply(function() {
                $mainCtrl.setGeneralStatusMsg(args.msgType, args.msg);
            });
        });
    }
})();