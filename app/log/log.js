(function() {
    'use strict';

    angular.module('SmartSweeper.log', []).controller('LogController', LogController);

    function LogController($scope, $document, $filter) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {
            $mainCtrl.setPageHeight();
            var logboxHeight = parseInt($document.find('#page-wrapper').css('height')) - $document.find('#log button').outerHeight(true) - 75;
            $document.find('#log textarea').css('height', logboxHeight + 'px');
            
            ipcRenderer.send('loadLog');
            ipcRenderer.on('logReady', (event, arg) => {
                $scope.$apply(function() {
                    ctrl.logContent = "No entries found.";
                    ctrl.mostRecentLog = electron.remote.getGlobal('availableLog');
                    console.log(ctrl.mostRecentLog);
                    if (ctrl.mostRecentLog != null) {
                        ctrl.logDate = $filter('date')(ctrl.mostRecentLog.date, 'longDate');
                        
                        if (ctrl.mostRecentLog.content.length > 0) {
                            ctrl.logContent = "";
                            
                            angular.forEach(ctrl.mostRecentLog.content, function(item, key) {
                                ctrl.logContent += "[" + $filter('date')(item.timestamp, 'HH:mm:ss a') + "] - " + item.message + "\n";
                            });
                        }
                    }
                });
            });
        };
        
        ctrl.openLogFolder = function() {
            ipcRenderer.send('openLogFolder');
        };
    }
})();