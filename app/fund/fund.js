(function() {
    'use strict';

    angular.module('SmartSweeper.fund', []).controller('FundController', FundController);

    function FundController($scope, $document) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {
            $mainCtrl.setActivePage('fund');
            
            // load all projects
            ipcRenderer.send('getProjects');
            ipcRenderer.on('projectsReady', (event, arg) => {
                $scope.$apply(function() {
                    ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                    console.log(ctrl.availableProjects);
                    // display the project list as 10 per page?
                    $mainCtrl.setPageHeight();
                });
            });
        };

        // transfer money to the project address
        function fundProject(projectID) {
        }
        
        // print paper wallets for a project
        function printWallets(projectID) {
        }
        
        // transfer money from the project address to the receiver wallets
        function sendFunds(projectID) {
        }
    }
})();