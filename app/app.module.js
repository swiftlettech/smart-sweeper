'use strict';

angular.module('SmartSweeper', [
    'SmartSweeper.dashboard',
    'SmartSweeper.send',
    //'SmartSweeper.sweep',
    //'SmartSweeper.log',
    'ui.bootstrap',
	'ngAnimate',
    'router',
	'ngTouch',
    'mj.jsNatMultisort'
])
.controller('SmartController', function($scope, $document, $filter) {
    const {ipcRenderer} = window.nodeRequire('electron');
    
    var ctrl = this;
    
    $scope.init = function() {
        $scope.scrollboxBaseheight = window.innerHeight - 150 - parseInt($document.find('body').css('margin-top'))*2;
		$document.find('#appAlert, .formAlert').addClass('hide');
    };
    
    $scope.$watch('formAlerts', function(newValue, oldValue, scope) {
        $scope.$broadcast('formAlertsAvailable');
    });
	
	$scope.$watch('appAlerts', function(newValue, oldValue, scope) {
        $scope.$broadcast('appAlertsAvailable');
    });
    
    ctrl.closeFormAlert = function(index) {
		if ($scope.formAlerts)
			$scope.formAlerts.splice(index, 1);
	};
	
	ctrl.closeAppAlert = function(index) {
		if ($scope.appAlerts)
			$scope.appAlerts.splice(index, 1);
	};
    
    /* Tab selection init. */
	ctrl.setActiveTab = function(tabIndex, tab) {
        $scope.setScrollboxHeight();
        $scope.closeAppAlert(0);
		$scope.closeFormAlert(0);
        
        $scope.tabIndex = tabIndex;
        $scope.activeTab = tab;
        
        $scope.tabIndex = 1;
    };
    
    ctrl.setScrollboxHeight = function() {
		var form;
		var extra;
		
		if ($scope.activeTab === "projectTab") {
			form = "#newProject";
			extra = 0;
		}
		
		$document.find('.scrollbox').css({
			height: function() {
				return $scope.scrollboxBaseheight - $document.find(form).outerHeight(true) - extra + "px";
			}
		});
	};
    
    /* Set the app or form alert message. */
	ctrl.setAppAlert = function(alertType, msgType, msg) {
		var prefix;
		var timeout;
		
		if (msgType === 'error') {
			msgType = 'danger';
			msg = "Error! " + msg;
		}
		else if (msgType === 'success') {
			msg = "Success! " + msg;
			timeout = alertTimeout;
		}
		
		if (alertType === "formAlert") {
			prefix = ".";
			$scope.formAlerts = [{
				'type': msgType,
				'msg': msg,
				'timeout': timeout
			}];
		}
		else if (alertType === "appAlert") {
			prefix = "#";
			$scope.appAlerts = [{
				'type': msgType,
				'msg': msg,
				'timeout': timeout
			}];
		}
	};
    
    ctrl.setAvailableProjects = function(projects) {
        $scope.availableProjects = projects;
    };
});