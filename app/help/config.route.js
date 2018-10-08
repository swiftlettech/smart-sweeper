(function() {
    'use strict';
	
	angular
        .module('SmartSweeper.help')
        .run(appRun);
	
	function appRun(routehelper) {
        routehelper.configureRoutes(getRoutes());
    }
	
	function getRoutes() {
        return [
            {
                url: '/help',
                config: {
                    templateUrl: 'app/help/help.html',
                    controller: 'HelpController',
                    controllerAs: '$helpCtrl',
                    title: ''
                }
            }
        ];
    }
})();