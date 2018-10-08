(function() {
    'use strict';
	
	angular
        .module('SmartSweeper.create')
        .run(appRun);
	
	function appRun(routehelper) {
        routehelper.configureRoutes(getRoutes());
    }
	
	function getRoutes() {
        return [
            {
                url: '/create',
                config: {
                    templateUrl: 'app/create/create.html',
                    controller: 'CreateController',
                    controllerAs: '$createCtrl',
                    title: ''
                }
            }
        ];
    }
})();