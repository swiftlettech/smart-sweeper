(function() {
    'use strict';
	
	var core = angular.module('SmartSweeper');
	
	var config = {
			'appTitle': 'SmartSweeper'
	};
	
	core.value('config', config);	
	core.config(configure);
	
	/* Originally from: https://github.com/johnpapa/ng-demos */
	function configure($logProvider, $locationProvider, $routeProvider, routehelperConfigProvider) {
        // Configure the common route provider
		routehelperConfigProvider.config.$locationProvider = $locationProvider;
        routehelperConfigProvider.config.$routeProvider = $routeProvider;
        routehelperConfigProvider.config.docTitle = config.appTitle;
    }
})();