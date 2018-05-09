(function() {
    'use strict';
    
    angular.module('SmartSweeper.dashboard', []).controller('DashboardController', DashboardController);

    function DashboardController($scope, $document, $filter, filterCompare) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {
            $scope.$on('onlineCheck', function(event, args) {
                ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                
                if (args.isOnline && ctrl.availableProjects.length > 0) {
                    availableFunds();
                }
                else {
                    ctrl.availableBalance = "n/a";
                    ctrl.pendingFunds = "n/a";
                    ctrl.confirmedFunds = "n/a";
                    ctrl.claimedFunds = "n/a";
                    ctrl.sweptFunds = "n/a";
                }
            });
            
            // load all projects
            ipcRenderer.on('projectsReady', (event, args) => {
                $scope.$apply(function() {
                    angular.forEach(electron.remote.getGlobal('availableProjects').list, function(project, key) {
                        project.showPrivateKey = false;
                    });
                    
                    ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                    ctrl.projectCount = ctrl.availableProjects.length;
                    console.log(ctrl.availableProjects);
                });
            });
            
            ipcRenderer.on('onlineCheck', (event, args) => {                
                $scope.$apply(function() {
                    if (args.isOnline && ctrl.projectCount > 0) {
                        availableFunds();
                    }
                });
            });
            
            ipcRenderer.on('rpcConnected', (event, args) => {
                txInfo();
                claimedFunds();
                //sweptFunds();
            });
            
            $mainCtrl.setPageHeight();
        };
        
        /* The total project funds that have yet to be sent to another wallet (all projects). */
        function availableFunds() {
            ctrl.availableBalance = 0;
            
            ipcRenderer.send('checkProjectBalances');
            ipcRenderer.on('balancesChecked', (event, args) => {                
                angular.forEach(ctrl.availableProjects, function(project, key) {
                    ctrl.availableBalance += project.currentFunds;
                });
                
                ctrl.availableBalance = $filter('toFixedNum')(parseFloat(ctrl.availableBalance), 8);
            });
        }
        
        /* Funds that have been transferred from a promotional wallet to a different wallet (all projects). */
        function claimedFunds() {
            ctrl.claimedFunds = 0;
            ctrl.claimedWalletsCount = 0;            
            
            ipcRenderer.send('getClaimedFundsInfo');
            ipcRenderer.on('claimedFundsInfo', (event, args) => {
                $scope.$apply(function() {
                    ctrl.claimedFunds = args.claimedFunds;
                    ctrl.claimedWalletsCount = args.claimedWallets;
                });
            });
        }
        
        /* The pending/confirmed state of all promotional wallets (all projects). */
        function txInfo() {
            ctrl.pendingFunds = 0;
            ctrl.pendingWalletsCount = 0;
            ctrl.confirmedFunds = 0;
            ctrl.confirmedWalletsCount = 0;
            
            ipcRenderer.send('getAllTxInfo');
            ipcRenderer.on('allTxInfo', (event, args) => {
                $scope.$apply(function() {
                    ctrl.pendingFunds = args.pendingFunds;
                    ctrl.pendingWalletsCount = args.pendingWallets;
                    ctrl.confirmedFunds = args.confirmedFunds;
                    ctrl.confirmedWalletsCount = args.confirmedWallets;
                });
            });
        }
        
        /* Funds that have been swept back to a project address (all projects). */
        function sweptFunds() {
            ctrl.sweptFunds = 0;
            ctrl.sweptWalletsCount = 0;
            
            ipcRenderer.send('getSweptFundsInfo');
            ipcRenderer.on('sweptFundsInfo', (event, args) => {
                $scope.$apply(function() {
                    ctrl.sweptFunds = args.sweptFunds;
                    ctrl.sweptWalletsCount = args.sweptWallets;
                });
            });
        }
    }
})();