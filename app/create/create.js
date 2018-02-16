(function() {
    'use strict';

    angular.module('SmartSweeper.create', []).controller('CreateController', CreateController);

    function CreateController($scope, $document, $filter, filterCompare) {
        var electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainctrl = $scope.$parent.$mainctrl;
        
        var ctrl = this;

        $scope.init = function() {
            ctrl.showAddNewProject = false;
            ctrl.newProject = {
                numAddr: 0,
                addrAmt: 0,
                qrCode: false,
                walletIns: false,
                sweepDate: ''
            };
            ctrl.nameSortFlag = 1;
            ctrl.expSortFlag = -1;
            
            ctrl.calendar = {
                opened: false
            };
            ctrl.datepickerOptions = {
                showWeeks: false
            };
            ctrl.datepickerFormat = "MM/dd/yyyy";

            // load all projects
            ipcRenderer.send('getProjects');
            ipcRenderer.on('projectsReady', (event, arg) => {
                $scope.$apply(function() {
                    ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                });
            });
            
            $mainctrl.setScrollboxHeight();
            $mainctrl.setPageHeight();
        };

        ctrl.delete = function(id) {
            ipcRenderer.send('getProjects', {type: 'confirmation', text: 'Are you sure you want to delete this project?'});
            
            /*ipcRenderer.on('modalYes', (event, arg) => {
                ctrl.activeProjectID = id;
                ipcRenderer.send('deleteProject', {id: id});
            });*/
        };

        ctrl.edit = function(id) {
            ctrl.activeProjectID = id;
            ctrl.activeProject = $filter('filter')(ctrl.availableProjects, {id: id}, filterCompare)[0];

            console.log(ctrl.activeProject);
            
            ipcRenderer.send('editProject', {project: ctrl.activeProject});
        };

        ctrl.new = function(form) {            
            ipcRenderer.send('newProject', {newProject: ctrl.newProject});
            ipcRenderer.on('newProjectAdded', (event, arg) => {                
                $('#addNewProjectForm')[0].reset()
                form.$setPristine();
                form.$setUntouched();
                form.$submitted = false;
            });
        };
        
        ctrl.openCalendar = function() {
            ctrl.calendar.opened = false;
        };

        ctrl.sort = function(type) {
            ctrl.sortOptions = {property: type};
        };
    }
})();