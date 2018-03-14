(function() {
    'use strict';
	
	angular
        .module('SmartSweeper.fund')
        .run(appRun);
	
	function appRun(routehelper) {
        routehelper.configureRoutes(getRoutes());
    }
	
	function getRoutes() {
        return [
            {
                url: '/fund',
                config: {
                    templateUrl: 'app/fund/fund.html',
                    controller: 'FundController',
                    controllerAs: '$fundCtrl',
                    title: ''
                }
            }
        ];
    }
})();