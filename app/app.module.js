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
    const electron = window.nodeRequire('electron');
    
    var ctrl = this;
    
    $scope.init = function() {
        ctrl.setPageHeight();
		$document.find('#appAlert, .formAlert').addClass('hide');
        
        /*$(window).on("resize", function(event) {
            ctrl.setPageHeight();
            ctrl.setScrollboxHeight($scope.formHeight);
		});*/
    };
    
    ctrl.setActivePage = function(page) {
        ctrl.activePage = page;
        console.log('active page: ' + ctrl.activePage);
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
        if (window.innerWidth >= 700 && window.innerHeight >= 600 && electron.remote.getGlobal('availableProjects').list.length < 8) {
            $document.find('#page-wrapper').css({
                height: function() {
                    return window.innerHeight - (parseInt($document.find('body').css('margin-top'))*2);
                }
            });
        }
    };
});