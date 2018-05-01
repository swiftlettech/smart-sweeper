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
            
            // load all projects
            ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
            console.log(ctrl.availableProjects);
            // display the project list as 10 per page?
            $mainCtrl.setPageHeight();
        };
        
        // ng-class="{disabled: !$mainCtrl.coreRunning || !$mainCtrl.rpcExplorerRunning}"
        
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
            ipcRenderer.send('sendFunds', {addressPair: project.addressPair, wallets: project.recvAddrs});
        };
    }
})();