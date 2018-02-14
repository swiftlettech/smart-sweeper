(function() {
    'use strict';
	
	angular
        .module('SmartSweeper.dashboard')
        .run(appRun);
	
	function appRun(routehelper) {
        routehelper.configureRoutes(getRoutes());
    }
	
	function getRoutes() {
        return [
            {
                url: '/dashboard',
                config: {
                    templateUrl: 'app/dashboard/dashboard.html',
                    controller: 'DashboardController',
                    controllerAs: '$dashboardCtrl',
                    title: ''
                }
            }
        ];
    }
})();