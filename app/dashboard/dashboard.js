(function() {
    'use strict';
    
    angular.module('SmartSweeper.dashboard', []).controller('DashboardController', DashboardController);

    function DashboardController($scope, $document, $filter, filterCompare) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {
            $mainCtrl.activePage = 'dashboard';
            
            ctrl.availableBalance = "n/a";
            ctrl.pendingFunds = "n/a";
            ctrl.pendingWalletsCount = 0;
            ctrl.sentFunds = "n/a";
            ctrl.sentWalletsCount = 0;
            ctrl.claimedFunds = "n/a";
            ctrl.claimedWalletsCount = 0;
            ctrl.sweptFunds = "n/a";
            ctrl.sweptWalletsCount = 0;
            
            // load all projects
            ipcRenderer.send('getProjects');
            ipcRenderer.on('projectsReady', (event, arg) => {
                $scope.$apply(function() {
                    ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                    ctrl.projectCount = ctrl.availableProjects.length;
                    ctrl.totalBalance = 0;
                    
                    if (ctrl.projectCount > 0) {
                        angular.forEach(ctrl.availableProjects, function(project, key) {
                            ctrl.totalBalance += project.totalFunds;
                        });
                        
                        //availableFunds();
                        //pendingFunds();
                        //sentFunds();
                        claimedFunds();
                    }
                    
                    ctrl.totalBalance = $filter('toFixedNum')(ctrl.totalBalance, 8);
                    
                    console.log(ctrl.availableProjects);
                });
            });
            
            $mainCtrl.setPageHeight();
        };
        
        /* The total project funds that have yet to be sent to another wallet. */
        function availableFunds() {
            
        }
        
        /* Funds that have been transferred from a promotional wallet to a different wallet. */
        function claimedFunds() {
            ipcRenderer.send('getClaimedFundsInfo');
            ipcRenderer.on('claimedFundsInfo', (event, args) => {
                $scope.$apply(function() {
                    ctrl.claimedFunds = $filter('toFixedNum')(args.claimedFunds, 8);
                    ctrl.claimedWalletsCount = args.claimedWallets;
                });
            });
        }
        
        /* Transactions that are in the blockchain but have less than 6 confirmations. */
        function pendingFunds() {
            ipcRenderer.send('getPendingFundsInfo');
            ipcRenderer.on('pendingFundsInfo', (event, args) => {
                $scope.$apply(function() {
                    ctrl.pendingFunds = $filter('toFixedNum')(args.pendingFunds, 8);
                    ctrl.pendingWalletsCount = args.pendingWallets;
                });
            });
        }
        
        /* Transactions that have 6+ confirmations. */
        function sentFunds() {
            ipcRenderer.send('getSentFundsInfo');
            ipcRenderer.on('sentFundsInfo', (event, args) => {
                $scope.$apply(function() {
                    ctrl.sentFunds = $filter('toFixedNum')(args.sentFunds, 8);
                    ctrl.sentWalletsCount = args.sentWallets;
                });
            });
        }
        
        /* Funds that have been swept back to a project address. */
        function sweptFunds() {
            ipcRenderer.send('getSweptFundsInfo');
            ipcRenderer.on('sweptFundsInfo', (event, args) => {
                $scope.$apply(function() {
                    ctrl.sweptFunds = $filter('toFixedNum')(args.sweptFunds, 8);
                    ctrl.sweptWalletsCount = args.sweptWallets;
                });
            });
        }
    }
})();