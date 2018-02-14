(function() {
    'use strict';

    angular.module('SmartSweeper.send', []).controller('SendController', SendController);

    function SendController($scope, $document, $filter, filterCompare) {
        var electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var ctrl = this;
        var $mainctrl = $scope.$parent.$mainctrl;

        $scope.init = function() {
            ctrl.showAddNewProject = false;
            ctrl.newProject = {};
            ctrl.nameSortFlag = 1;
            ctrl.expSortFlag = -1;

            // load all projects
            ipcRenderer.send('getProjects');
            ipcRenderer.on('projectsReady', (event, arg) => {
                $scope.$apply(function() {
                    ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                });
            });
        };

        ctrl.delete = function(id) {
            ctrl.activeProjectID = id;
            ipcRenderer.send('deleteProject', {id: id});
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

        ctrl.sort = function(type) {
            ctrl.sortOptions = {property: type};
        };
    }
})();