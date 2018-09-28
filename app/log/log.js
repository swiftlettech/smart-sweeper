(function() {
    'use strict';

    angular.module('SmartSweeper.log', []).controller('LogController', LogController);

    function LogController($scope, $document, $filter) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {            
            ipcRenderer.send('loadLog');
            ipcRenderer.on('logReady', (event, arg) => {
                $scope.$apply(function() {
                    ctrl.logContent = "No entries found.";
                    ctrl.mostRecentLog = electron.remote.getGlobal('availableLog');
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
            
            // set the height of the logbox            
            // windowHeight - status messages - open button            
            var buttonHeight = $document.find('#openLogFolder').outerHeight(true);
            var logboxHeight = window.innerHeight - (parseInt($document.find('body').css('margin')) * 2) - $document.find('#statusMsgs').height() - $document.find('#logHeader').outerHeight(true);
            
            /*console.log(buttonHeight)
            console.log($document.find('#statusMsgs').outerHeight(true))
            console.log($document.find('#logHeader').outerHeight(true))*/
            
            $document.find('#log textarea').css('height', (window.innerHeight - window.innerHeight * 0.55) + 'px');
        };
        
        ctrl.openLogFolder = function() {
            ipcRenderer.send('openLogFolder');
        };
        
        ctrl.refreshLog = function() {
            ipcRenderer.send('refreshLog');
        };
    }
})();