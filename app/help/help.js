(function() {
    'use strict';

    angular.module('SmartSweeper.help', []).controller('HelpController', HelpController);

    function HelpController($scope, $document) {
        var ctrl = this;

        $scope.init = function() {
            $mainCtrl.setActivePage('help');
        };
    }
})();