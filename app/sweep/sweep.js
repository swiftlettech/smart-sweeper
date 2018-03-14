(function() {
    'use strict';

    angular.module('SmartSweeper.sweep', []).controller('SweepController', SweepController);

    function SweepController($scope, $document) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {
            $mainCtrl.setActivePage('sweep');
            
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
        
        // return funds back to project address manually after expiration date
        function sweep(projectID) {
        }
    }
})();