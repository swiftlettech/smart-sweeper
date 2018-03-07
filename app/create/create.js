(function() {
    'use strict';

    angular.module('SmartSweeper.create', ['SmartSweeperUtils']).controller('CreateController', CreateController);

    function CreateController($rootScope, $scope, $document, $filter, alertservice, filterCompare, greaterThanZeroIntPattern, greaterThanZeroAllPattern) {
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
                    console.log(ctrl.availableProjects);
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
        
        ctrl.createAddresses = function(form) {
            // disable the create project button
            $document.find('#addNewProjectForm button').attr('disabled', 'disabled');
            
            ipcRenderer.on('dialogNo', (event, arg) => {
                if (electron.remote.getGlobal('referrer') !== "createAddresses")
                    return;

                $document.find('#addNewProjectForm button').removeAttr('disabled');
            });

            ipcRenderer.on('dialogYes', (event, arg) => {
                if (electron.remote.getGlobal('referrer') !== "createAddresses")
                    return;
                
                if (ctrl.newProject.recvAddrs !== undefined && ctrl.newProject.recvAddrs.length == 0) {
                    // create the addresses and add them to the project
                    ipcRenderer.send('createRecvAddresses', {project: ctrl.newProject, newProjectFlag: true});
                    ipcRenderer.on('addressesCreated', (event, arg) => {
                        ctrl.newProject = {};
                        form.$setPristine();
                        form.$setUntouched();
                        form.$submitted = false;
                        
                        ctrl.formAlerts = alertservice.createAlert('formAlert', 'success', 'Addresses created.');
                    });
                }
                else {
                    console.log('receiver addresses already created')   
                }
            });
            
            form.$submitted = true;
            if (form.$valid) {
                ctrl.newProject.numAddr = parseInt(ctrl.newProject.numAddr);
                ctrl.newProject.recvAddrs = [];
                
                ipcRenderer.send('setReferrer', {referrer: 'createAddresses'});
                ipcRenderer.send('showConfirmation', {title: 'Create receiver addresses?', body: 'Are you sure you want to create receiver addresses for this project?'});
            }
        };

        /* Delete a project. */
        ctrl.delete = function(id) {
            ctrl.activeProjectID = id;
            ipcRenderer.send('setReferrer', {referrer: 'deleteProject'});
            ipcRenderer.send('showConfirmation', {title: 'Delete project?', body: 'Are you sure you want to delete this project?'});
            
            ipcRenderer.on('dialogYes', (event, arg) => {
                if (electron.remote.getGlobal('referrer') !== "deleteProject")
                    return;
                
                ipcRenderer.send('deleteProject', {id: id});
            });
        };

        /* Load a modal used to edit a project. */
        ctrl.edit = function(id) {
            ctrl.activeProjectID = id;
            ctrl.activeProject = $filter('filter')(ctrl.availableProjects, {id: id}, filterCompare)[0];

            console.log(ctrl.activeProject);
            
            ipcRenderer.send('editProject', {project: ctrl.activeProject});
        };

        /* Create a new project. */
        ctrl.new = function(form) {
            ctrl.newProject.numAddr = parseInt(ctrl.newProject.numAddr);
            ctrl.newProject.recvAddrs = [];
            
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
            //var formHeight = $scope.formHeight;
            
            ctrl.showAddNewProject = !ctrl.showAddNewProject;
            
            if (ctrl.showAddNewProject && ctrl.availableProjects.length > 3)
                $document.find('#page-wrapper').css('height', '');
            else
                $mainCtrl.setPageHeight();
            
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