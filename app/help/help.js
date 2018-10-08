(function() {
    'use strict';

    angular.module('SmartSweeper.help', []).controller('HelpController', HelpController);

    function HelpController($scope, $document) {
        const electron = window.nodeRequire('electron');
        var ctrl = this;

        $scope.init = function() {
            $mainCtrl.setActivePage('help');
        };
        
        ctrl.openWebsite = function(url) {
            electron.shell.openExternal(url);
        };
    }
})();