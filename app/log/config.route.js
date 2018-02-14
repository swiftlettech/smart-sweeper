(function() {
    'use strict';
	
	angular
        .module('SmartSweeper.log')
        .run(appRun);
	
	function appRun(routehelper) {
        routehelper.configureRoutes(getRoutes());
    }
	
	function getRoutes() {
        return [
            {
                url: '/log',
                config: {
                    templateUrl: 'app/log/log.html',
                    controller: 'LogController',
                    title: ''
                }
            }
        ];
    }
})();