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
		//$document.find('#appAlert, .formAlert').addClass('hide');
        
        /*$(window).on("resize", function(event) {
            ctrl.setPageHeight();
		});*/
    };
    
    ctrl.setActivePage = function(page) {
        ctrl.activePage = page;
        console.log('active page: ' + ctrl.activePage);
    };
    
    ctrl.setPageHeight = function() {        
        if ((ctrl.activePage === "create" || ctrl.activePage === "fund" || ctrl.activePage === "sweep") && electron.remote.getGlobal('availableProjects').list.length > 7) {
            $document.find('#page-wrapper').css('height', '');
            return;
        }
        
        if (window.innerWidth >= 700 && window.innerHeight >= 600) {
            $document.find('#page-wrapper').css({
                height: function() {
                    return window.innerHeight - (parseInt($document.find('body').css('margin-top'))*2);
                }
            });
        }
    };
});