(function() {
    'use strict';
    
    angular.module('SmartSweeper.dashboard', []).controller('DashboardController', DashboardController);

    function DashboardController($scope, $document, $filter, filterCompare) {
        var ctrl = this;
        var $mainCtrl = $scope.$parent.$mainCtrl;

        $scope.init = function() {
            $mainCtrl.activePage = 'dashboard';
        };

        //TODO: available balance display
        //TODO: pending display
        //TODO: sent display
    }
})();