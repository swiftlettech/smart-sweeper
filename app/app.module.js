'use strict';

angular.module('SmartSweeper', [
    'SmartSweeper.dashboard',
    'SmartSweeper.create',
    'SmartSweeper.fund',
    'SmartSweeper.sweep',
    'SmartSweeper.log',
    'SmartSweeper.help',
    'SmartSweeperUtils',
    'ui.bootstrap',
	'ngAnimate',
    'router',
	'ngTouch'
    //'mj.jsNatMultisort'
])
.controller('SmartController', function($scope, $document, $filter) {
    const {ipcRenderer} = window.nodeRequire('electron');
    
    var ctrl = this;
    
    $scope.init = function() {
        //ctrl.scrollboxBaseheight = window.innerHeight - (parseInt($document.find('body').css('margin-top'))*2);
        ctrl.setPageHeight();
		$document.find('#appAlert, .formAlert').addClass('hide');
        
        /*$(window).on("resize", function(event) {
            ctrl.setPageHeight();
            ctrl.setScrollboxHeight($scope.formHeight);
		});*/
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
    
    ctrl.setActivePage = function(page) {
        ctrl.activePage = page;
        console.log('active page: ' + ctrl.activePage);
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
    
    /*ctrl.setScrollboxHeight = function(formHeight) {
        var form;
        var extra;

        if (ctrl.activePage === "create") {
            form = "#addNewProjectForm";
            extra = $document.find('#newProjectShowBtn').height() + 90;
        }
        
        $scope.scrollboxHeight = ctrl.scrollboxBaseheight - formHeight - parseInt($document.find(form).css('margin-top')) - extra + "px";
        
        console.log(ctrl.scrollboxBaseheight);
        console.log(formHeight);
        console.log(parseInt($document.find(form).css('margin-top')));
        console.log(extra);
    };*/
    
    ctrl.setPageHeight = function() {
        if (window.innerWidth >= 700 && window.innerHeight >= 600) {
            $document.find('#page-wrapper').css({
                height: function() {
                    return window.innerHeight - (parseInt($document.find('body').css('margin-top'))*2);
                }
            });
        }
    };
});