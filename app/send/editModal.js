'use strict';

angular.module('SmartSweeper', [
	'ngAnimate',
	'ngRoute',
	'ngTouch'
])
.controller('EditController', function($scope, $document, $filter) {
    var ctrl = this;
    
    ctrl.init = function() {
        console.log(localStorage);
        
        ctrl.activeProject = {
            name: localStorage.projectName,
            desc: localStorage.projectDesc,
            exp: localStorage.projectExp,
            funds: localStorage.projectFunds,
            numOfWallets: localStorage.projectWalletNum,
            amtPerWallet: localStorage.projectWalletAmt
        };
    };
    
    ctrl.cancel = function() {
        console.log('modal cancel');
    };
    
    ctrl.update = function() {
        console.log('modal update');
    };
});