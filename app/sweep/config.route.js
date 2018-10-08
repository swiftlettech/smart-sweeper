(function() {
    'use strict';
	
	angular
        .module('SmartSweeper.sweep')
        .run(appRun);
	
	function appRun(routehelper) {
        routehelper.configureRoutes(getRoutes());
    }
	
	function getRoutes() {
        return [
            {
                url: '/sweep',
                config: {
                    templateUrl: 'app/sweep/sweep.html',
                    controller: 'SweepController',
                    controllerAs: '$sweepCtrl',
                    title: ''
                }
            }
        ];
    }
})();