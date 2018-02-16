(function() {
    'use strict';

    angular.module('SmartSweeper.edit', []).controller('EditController', EditController);

    function EditController($scope, $document, $filter) {
        var electron = require('electron');
        var ctrl = this;

        $scope.init = function() {
            ctrl.activeProject = electron.remote.getGlobal('activeProject');
            
            ctrl.datepickerOptions = {
                showWeeks: false
            };
            ctrl.datepickerFormat = "MM/dd/yyyy";
        };

        ctrl.cancel = function() {
            console.log('modal cancel');
        };

        ctrl.update = function() {
            console.log('modal update');
        };
        
        //TODO: paper wallet generator
        //TODO: QR code generator
    }
})();