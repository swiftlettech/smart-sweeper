(function() {
    'use strict';

    angular.module('SmartSweeper.log', []).controller('LogController', LogController);

    function LogController($scope, $document) {
        var ctrl = this;

        $scope.init = function() {

        };

        //TODO: list all transactions, most recent first
        //TODO: allow the user to filter transactions by keyword
    }
})();