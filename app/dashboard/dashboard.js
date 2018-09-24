(function() {
    'use strict';
    
    angular.module('SmartSweeper.dashboard', []).controller('DashboardController', DashboardController);

    function DashboardController($scope, $document, $interval, $filter, filterCompare) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {
            resetDashboardVals();
            
            $scope.$on('onlineCheck', function(event, args) {
                resetDashboardVals();
                
                if (ctrl.availableProjects.length === undefined || ctrl.availableProjects.length == 0) {
                    ctrl.availableBalance = "n/a";
                    ctrl.pendingFunds = "n/a";
                    ctrl.confirmedFunds = "n/a";
                    ctrl.claimedFunds = "n/a";
                    ctrl.sweptFunds = "n/a";
                }
                
                // load the last saved dashboard values from the app config file
                ipcRenderer.send('getSavedAppData');
                ipcRenderer.on('savedAppData', (event, args) => {
                    $scope.$apply(function() {
                        var savedAppData = args.savedAppData;

                        ctrl.availableBalance = savedAppData.availableBalanceTotal;
                        ctrl.claimedFunds = savedAppData.claimedFundsTotal;
                        ctrl.claimedWalletsCount = savedAppData.claimedWalletsTotal;
                        ctrl.pendingFunds = savedAppData.pendingFundsTotal;
                        ctrl.pendingWalletsCount = savedAppData.pendingWalletsTotal;
                        ctrl.confirmedFunds = savedAppData.confirmedFundsTotal;
                        ctrl.confirmedWalletsCount = savedAppData.confirmedWalletsTotal;
                        ctrl.sweptFunds = savedAppData.sweptFundsTotal;
                        ctrl.sweptWalletsCount = savedAppData.sweptWalletsTotal;
                    });
                });
            });
            
            // load all projects
            if (angular.isArray(electron.remote.getGlobal('availableProjects').list))
                ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
            
            ipcRenderer.on('coreSynced', (event, args) => {
                $scope.$apply(function() {
                    availableFunds();
                    //txInfo();
                    //claimedFunds();
                    //sweptFunds();
                });
            });
        };
        
        // reload projects when there have been changes
        ipcRenderer.on('projectsReady', (event, args) => {            
            $scope.$apply(function() {
                ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                ctrl.projectCount = ctrl.availableProjects.length;
                
                angular.forEach(ctrl.availableProjects, function(project, key) {
                    project.showPrivateKey = false;
                });

                ctrl.projectCount = ctrl.availableProjects.length;
            });
        });
        
        ipcRenderer.on('balancesChecked', (event, args) => {
            ctrl.availableBalance = 0;
            
            $scope.$apply(function() {
                $mainCtrl.setProgressSpinner('dashboardSpinner', false, 0);
                ctrl.availableBalance = $filter('toFixedNum')(args.availableBalance, 8);
            });
        });
        
        /* Show/hide various progress spinners. */
        ipcRenderer.on('toggleProgressSpinner', (event, args) => {
            $scope.$apply(function() {
                var toggle = args.status;
                
                if (args.function === "getWalletTxStatus") {
                    $scope.dashboardSpinner[1] = toggle;
                    $scope.dashboardSpinner[2] = toggle;
                }
                else if (args.function === "getClaimedFundsInfo") {
                    $scope.dashboardSpinner[3] = toggle;
                }
                else if (args.function === "getSweptFundsInfo") {
                    $scope.dashboardSpinner[4] = toggle;
                }
                
                ctrl.dashboardSpinner = $scope.dashboardSpinner;
            });
        });
        
        ipcRenderer.on('allTxInfo', (event, args) => {
            ctrl.pendingFunds = 0;
            ctrl.pendingWalletsCount = 0;
            ctrl.confirmedFunds = 0;
            ctrl.confirmedWalletsCount = 0;
            
            $scope.$apply(function() {
                $mainCtrl.setProgressSpinner('dashboardSpinner', false, 1);
                $mainCtrl.setProgressSpinner('dashboardSpinner', false, 2);
                
                ctrl.pendingFunds = args.pendingFunds;
                ctrl.pendingWalletsCount = args.pendingWallets;
                ctrl.confirmedFunds = args.confirmedFunds;
                ctrl.confirmedWalletsCount = args.confirmedWallets;
                ctrl.allTxInfo = true;
            });
        });
        
        ipcRenderer.on('claimedFundsInfo', (event, args) => {
            ctrl.claimedFunds = 0;
            ctrl.claimedWalletsCount = 0;

            $scope.$apply(function() {
                $mainCtrl.setProgressSpinner('dashboardSpinner', false, 3);
                ctrl.claimedFunds = args.claimedFunds;
                ctrl.claimedWalletsCount = args.claimedWallets;
            });
        });
        
        ipcRenderer.on('sweptFundsInfo', (event, args) => {
            ctrl.sweptFunds = 0;
            ctrl.sweptWalletsCount = 0;

            $scope.$apply(function() {
                $mainCtrl.setProgressSpinner('dashboardSpinner', false, 4);
                ctrl.sweptFunds = args.sweptFunds;
                ctrl.sweptWalletsCount = args.sweptWalletsCount;
            });
        });
        
        /* The total project funds that have yet to be sent to another wallet (all projects). */
        function availableFunds() {
            $mainCtrl.setProgressSpinner('dashboardSpinner', true, 0);
            ipcRenderer.send('checkAvailProjectBalances');
            
            // status checking
            /*ctrl.taskStatusCheck = $interval(function() {
                ipcRenderer.send('taskStatusCheck', 'checkAvailProjectBalances');
            }, 5000);
            
            ipcRenderer.on('taskStatusCheckDone', (event, args) => {
                ipcRenderer.removeAllListeners('taskStatusCheckDone');
                $scope.$apply(function() {
                    if (args.function === "checkAvailProjectBalances" && args.status == true) {
                        $interval.cancel(ctrl.taskStatusCheck);
                        $mainCtrl.setProgressSpinner('dashboardSpinner', false, 0);
                    }
                    else
                        $mainCtrl.setProgressSpinner('dashboardSpinner', true, 0);
                });
            });*/
        }
        
        /* Funds that have been transferred from a promotional wallet to a different wallet (all projects). - NOT USED */
        function claimedFunds() {
            $mainCtrl.setProgressSpinner('dashboardSpinner', true, 3);
            ipcRenderer.send('getClaimedFundsInfo');
        }
        
        /* Funds that have been swept back to a project address (all projects). - NOT USED */
        function sweptFunds() {
            $mainCtrl.setProgressSpinner('dashboardSpinner', true, 4);
            ipcRenderer.send('getSweptFundsInfo');
        }
        
        /* The pending/confirmed state of all promotional wallets (all projects). - NOT USED */
        function txInfo() {
            $mainCtrl.setProgressSpinner('dashboardSpinner', true, 1);
            $mainCtrl.setProgressSpinner('dashboardSpinner', true, 2);
            ipcRenderer.send('getWalletTxStatus');
        }
        
        /* Resets all amounts/counts for dashboard variables. */
        function resetDashboardVals() {
            ctrl.availableBalance = 0;
            ctrl.claimedFunds = 0;
            ctrl.claimedWalletsCount = 0;
            ctrl.pendingFunds = 0;
            ctrl.pendingWalletsCount = 0;
            ctrl.confirmedFunds = 0;
            ctrl.confirmedWalletsCount = 0;
            ctrl.sweptFunds = 0;
            ctrl.sweptWalletsCount = 0;
        }
    }
})();