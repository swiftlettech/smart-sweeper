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
            ctrl.progressSpinner = ['false', 'false', 'false', 'false', 'false'];
            
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
            
            ipcRenderer.on('rpcConnected', (event, args) => {
                $scope.$apply(function() {
                    ctrl.projectCount = ctrl.availableProjects.length;

                    availableFunds();
                    //txInfo();
                    //claimedFunds();
                    //sweptFunds();
                });
            });
            
            //$mainCtrl.setPageHeight();
        };
        
        // reload projects when there have been changes
        ipcRenderer.on('projectsReady', (event, args) => {            
            $scope.$apply(function() {
                ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                
                angular.forEach(ctrl.availableProjects, function(project, key) {
                    project.showPrivateKey = false;
                });

                ctrl.projectCount = ctrl.availableProjects.length;
                console.log(ctrl.availableProjects);
            });
        });
        
        ipcRenderer.on('balancesChecked', (event, args) => {
            ctrl.availableBalance = 0;
            
            $scope.$apply(function() {
                ctrl.progressSpinner[0] = false;
                ctrl.availableBalance = $filter('toFixedNum')(args.availableBalance, 8);
            });
        });
        
        ipcRenderer.on('allTxInfo', (event, args) => {
            ctrl.pendingFunds = 0;
            ctrl.pendingWalletsCount = 0;
            ctrl.confirmedFunds = 0;
            ctrl.confirmedWalletsCount = 0;
            
            $scope.$apply(function() {
                ctrl.progressSpinner[1] = false;
                ctrl.progressSpinner[2] = false;
                
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
                ctrl.progressSpinner[3] = false;
                ctrl.claimedFunds = args.claimedFunds;
                ctrl.claimedWalletsCount = args.claimedWallets;
            });
        });
        
        ipcRenderer.on('sweptFundsInfo', (event, args) => {
            ctrl.sweptFunds = 0;
            ctrl.sweptWalletsCount = 0;

            $scope.$apply(function() {
                ctrl.progressSpinner[4] = false;
                ctrl.sweptFunds = args.sweptFunds;
                ctrl.sweptWalletsCount = args.sweptWalletsCount;
            });
        });
        
        /* The total project funds that have yet to be sent to another wallet (all projects). */
        function availableFunds() {
            ctrl.progressSpinner[0] = true;
            ipcRenderer.send('checkAvailProjectBalances');
            
            // status checking
            /*ctrl.taskStatusCheck = $interval(function() {
                ipcRenderer.send('taskStatusCheck', 'checkAvailProjectBalances');
            }, 5000);
            
            ipcRenderer.on('taskStatusCheckDone', (event, args) => {
                ipcRenderer.removeAllListeners('taskStatusCheckDone');
                $scope.$apply(function() {
                    if (args.function === "checkAvailProjectBalances" && (args.status == true || args.error == true)) {
                        $interval.cancel(ctrl.taskStatusCheck);
                    }
                    else
                        ctrl.showSpinner = true;
                });
            });*/
        }
        
        /* Funds that have been transferred from a promotional wallet to a different wallet (all projects). */
        function claimedFunds() {
            ctrl.progressSpinner[3] = true;
            ipcRenderer.send('getClaimedFundsInfo');
        }
        
        /* Funds that have been swept back to a project address (all projects). */
        function sweptFunds() {
            ctrl.progressSpinner[4] = true;
            ipcRenderer.send('getSweptFundsInfo');
        }
        
        /* The pending/confirmed state of all promotional wallets (all projects). */
        function txInfo() {
            ctrl.progressSpinner[1] = true;
            ctrl.progressSpinner[2] = true;
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