(function() {
    'use strict';
    
    angular.module('SmartSweeper.dashboard', []).controller('DashboardController', DashboardController);

    function DashboardController($scope, $document, $filter, filterCompare) {
        var ctrl = this;
        var $mainctrl = $scope.$parent.$mainctrl;

        $scope.init = function() {

        };

        //TODO: available balance display
        //TODO: pending display
        //TODO: sent display
    }
})();