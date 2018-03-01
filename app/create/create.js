(function() {
    'use strict';

    angular.module('SmartSweeper.create', []).controller('CreateController', CreateController);

    function CreateController($rootScope, $scope, $document, $filter, filterCompare, greaterThanZeroIntPattern, greaterThanZeroAllPattern) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {
            $mainCtrl.setActivePage('create');
            
            ctrl.greaterThanZeroIntPattern = greaterThanZeroIntPattern;
            ctrl.greaterThanZeroAllPattern = greaterThanZeroAllPattern;
            
            ctrl.showAddNewProject = false;
            ctrl.newProject = {
                numAddr: 0,
                addrAmt: 0,
                qrCode: false,
                walletIns: false,
                sweep: false,
                sweepDate: ''
            };
            ctrl.nameSortFlag = 1;
            ctrl.sweepDateSortFlag = 1;
            ctrl.sortOptions = {property: 'name'};
            
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
                    // display the project list as 10 per page?
                });
            });
        };
        
        /*$scope.$on('$viewContentLoaded', function(event) {
            $mainCtrl.setPageHeight();
        });*/
        
        /*$scope.$watch('formHeight', function(newValue, oldValue, scope) {
            console.log(oldValue);
            console.log(newValue);
            
            if (newValue != oldValue)
                $mainCtrl.setScrollboxHeight(newValue);
        });*/
        
        /* Create the wallet addresses for the project. */
        ctrl.createAddresses = function(form) {
            // disable the create project button
            $document.find('#addNewProjectForm button[type=submit]').attr('disabled', 'disabled');
            
            if (form.$valid) {
                $mainCtrl.setConfirmationReferrer('createAddresses'); 
                ipcRenderer.send('loadConfirmation', 'Are you sure you want to create addresses for this project?');
            }
            
            ipcRenderer.on('modalNo', (event, arg) => {
                if ($mainCtrl.confirmationReferrer !== 'createAddresses')
                    return;
                
                $document.find('#addNewProjectForm button[type=submit]').removeAttr('disabled');
            });
            
            ipcRenderer.on('modalYes', (event, arg) => {                
                if ($mainCtrl.confirmationReferrer !== 'createAddresses')
                    return;
                
                console.log('modal yes in create addresses');
                
                // submit the form and create the project
                form.$submitted = true;
                //ctrl.new(form);
                
                // create the addresses and add them to the project
                
                // save the updated project
            });
        };

        /* Delete a project. */
        ctrl.delete = function(id) {
            $mainCtrl.setConfirmationReferrer(deleteProject);            
            ipcRenderer.send('loadConfirmation', 'Are you sure you want to delete this project?');
            
            ipcRenderer.on('modalYes', (event, arg) => {
                if ($mainCtrl.confirmationReferrer !== 'deleteProject')
                    return;
                    
                ctrl.activeProjectID = id;
                ipcRenderer.send('deleteProject', {id: id});
            });
        };

        /* Edit a project. */
        ctrl.edit = function(id) {
            ctrl.activeProjectID = id;
            ctrl.activeProject = $filter('filter')(ctrl.availableProjects, {id: id}, filterCompare)[0];

            console.log(ctrl.activeProject);
            
            ipcRenderer.send('editProject', {project: ctrl.activeProject});
        };

        /* Create a new project. */
        ctrl.new = function(form) {
            ctrl.newProject.numAddr = parseInt(ctrl.newProject.numAddr);
            
            ipcRenderer.send('newProject', {newProject: ctrl.newProject});
            ipcRenderer.on('newProjectAdded', (event, arg) => {                
                ctrl.newProject = {};
                form.$setPristine();
                form.$setUntouched();
                form.$submitted = false;
            });
        };
        
        /* Open the calendar popup. */
        ctrl.openCalendar = function() {
            ctrl.calendar.opened = true;
        };
        
        /* Called when the "new project" button is clicked. */
        ctrl.showAddForm = function() {
            var formHeight = $scope.formHeight;
            
            ctrl.showAddNewProject = !ctrl.showAddNewProject;
            
            //if (!ctrl.showAddNewProject)
                //formHeight = $document.find('#newProjectShowBtn');
                
            //$mainCtrl.setScrollboxHeight(formHeight);
        };

        /* Sort the project list. */
        ctrl.sort = function(type, reverse) {
            ctrl.sortOptions.property = type;
            ctrl.sortOptions.reverse = reverse;
            
            //console.log(jsMultisort);
        };
    }
})();