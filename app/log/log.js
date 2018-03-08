(function() {
    'use strict';

    angular.module('SmartSweeper.log', []).controller('LogController', LogController);

    function LogController($scope, $document) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        
        var ctrl = this;

        $scope.init = function() {
            ipcRenderer.send('loadLog');
            ipcRenderer.on('logReady', (event, arg) => {
                $scope.$apply(function() {
                    ctrl.mostRecentLog = electron.remote.getGlobal('availableLog');
                    console.log(ctrl.mostRecentLog);
                });
            });
        };
        
        ctrl.openLogFolder = function() {
        };

        //TODO: list all transactions, most recent first
    }
})();