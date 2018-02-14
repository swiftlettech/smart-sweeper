(function() {
    'use strict';
	
	angular
        .module('SmartSweeper.send')
        .run(appRun);
	
	function appRun(routehelper) {
        routehelper.configureRoutes(getRoutes());
    }
	
	function getRoutes() {
        return [
            {
                url: '/send',
                config: {
                    templateUrl: 'app/send/send.html',
                    controller: 'SendController',
                    controllerAs: '$sendCtrl',
                    title: ''
                }
            }
        ];
    }
})();