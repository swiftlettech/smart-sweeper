(function() {
    'use strict';
    
    angular.module('SmartSweeper.dashboard', []).controller('DashboardController', DashboardController);

    function DashboardController($scope, $document, $filter, filterCompare) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {
            ctrl.availableBalance = 0;
            ctrl.pendingFunds = 0;
            ctrl.pendingWalletsCount = 0;
            ctrl.confirmedFunds = 0;
            ctrl.confirmedWalletsCount = 0;
            ctrl.claimedFunds = 0;
            ctrl.claimedWalletsCount = 0;
            ctrl.sweptFunds = 0;
            ctrl.sweptWalletsCount = 0;            
            
            // load all projects
            ipcRenderer.on('projectsReady', (event, args) => {
                $scope.$apply(function() {
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
                    else {
                        ctrl.availableBalance = "n/a";
                        ctrl.pendingFunds = "n/a";
                        ctrl.confirmedFunds = "n/a";
                        ctrl.claimedFunds = "n/a";
                        ctrl.sweptFunds = "n/a";
                    }
                });
            });
            
            ipcRenderer.on('rpcConnected', (event, args) => {
                txInfo();
                //claimedFunds();
                //sweptFunds();
            });
            
            $mainCtrl.setPageHeight();
        };
        
        /* The total project funds that have yet to be sent to another wallet (all projects). */
        function availableFunds() {            
            ipcRenderer.send('checkProjectBalances');
            ipcRenderer.on('balancesChecked', (event, args) => {
                angular.forEach(ctrl.availableProjects, function(project, key) {
                    ctrl.availableBalance += project.totalFunds;
                });
                
                ctrl.availableBalance = $filter('toFixedNum')(ctrl.availableBalance, 8);
            });
        }
        
        /* Funds that have been transferred from a promotional wallet to a different wallet (all projects). */
        function claimedFunds() {
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
            /*ipcRenderer.send('getSweptFundsInfo');
            ipcRenderer.on('sweptFundsInfo', (event, args) => {
                $scope.$apply(function() {
                    ctrl.sweptFunds = args.sweptFunds;
                    ctrl.sweptWalletsCount = args.sweptWallets;
                });
            });*/
        }
    }
})();