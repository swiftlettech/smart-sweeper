(function() {
    'use strict';

    angular.module('SmartSweeperUtils').factory('alertservice', alertservice);

    function alertservice($rootScope, alertTimeout) {    
        return {
            createAlert: createAlert,
            closeAlert: closeAlert
        };

        function createAlert(alertType, msgType, msg) {
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
                //prefix = ".";
                var formAlerts = [{
                    'type': msgType,
                    'msg': msg,
                    'timeout': timeout
                }];                
                return formAlerts;
            }
            else if (alertType === "appAlert") {
                //prefix = "#";
                var appAlerts = [{
                    'type': msgType,
                    'msg': msg,
                    'timeout': timeout
                }];
                return appAlerts;
            }
        }

        function closeAlert(type) {
            if (type === "formAlert")
                $rootScope.formAlerts.splice(0, 1);

            if (type === "appAlert")
                $rootScope.appAlerts.splice(0, 1);
        }
        
        function closeAllAlerts() {
            if ($rootScope.formAlerts.length > 0)
                $rootScope.formAlerts.splice(0, 1);

            if ($rootScope.appAlerts.length > 0)
                $rootScope.appAlerts.splice(0, 1);
        }
    }
})();
    
    /*var ctrl = this;
    
    $scope.$watch('formAlerts', function(newValue, oldValue, scope) {
        $scope.$broadcast('formAlertsAvailable');
    });
	
	$scope.$watch('appAlerts', function(newValue, oldValue, scope) {
        $scope.$broadcast('appAlertsAvailable');
    });
    
    ctrl.closeFormAlert = function() {
		if ($scope.formAlerts)
			$scope.formAlerts.splice(0, 1);
	};
	
	ctrl.closeAppAlert = function() {
		if ($scope.appAlerts)
			$scope.appAlerts.splice(0, 1);
	};*/
    
    /* Set the app or form alert message. */
	/*ctrl.setAppAlert = function(alertType, msgType, msg) {
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
	};*/