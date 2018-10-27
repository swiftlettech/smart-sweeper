(function() {
    'use strict';
    
    angular.module('SmartSweeper.dashboard', []).controller('DashboardController', DashboardController);

    function DashboardController($scope, $document, $interval, $filter, filterCompare) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {
            //resetDashboardVals();
            
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
            
            // load spinner statuses from $mainCtrl
            ctrl.dashboardSpinner = $scope.dashboardSpinner;
            
            $scope.$on('onlineCheck', function(event, args) {
                //resetDashboardVals();
                
                if (ctrl.availableProjects.length === undefined || ctrl.availableProjects.length == 0) {
                    ctrl.availableBalance = "n/a";
                    ctrl.pendingFunds = "n/a";
                    ctrl.confirmedFunds = "n/a";
                    ctrl.claimedFunds = "n/a";
                    ctrl.sweptFunds = "n/a";
                }
            });
            
            // load all projects
            if (angular.isArray(electron.remote.getGlobal('availableProjects').list))
                ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
            
            ipcRenderer.on('coreSynced', (event, args) => {
                $scope.$apply(function() {
                    availableFunds();
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
                    $mainCtrl.setProgressSpinner('dashboardSpinner', toggle, 1);
                    $mainCtrl.setProgressSpinner('dashboardSpinner', toggle, 2);
                }
                else if (args.function === "getClaimedFundsInfo") {
                    $mainCtrl.setProgressSpinner('dashboardSpinner', toggle, 3);
                }
                else if (args.function === "getSweptFundsInfo") {
                    $mainCtrl.setProgressSpinner('dashboardSpinner', toggle, 4);
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
        }
        
        /* Resets all amounts/counts for dashboard variables. - NOT USED */
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