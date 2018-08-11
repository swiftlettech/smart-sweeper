(function() {
    'use strict';

    angular.module('SmartSweeper.create', ['SmartSweeperUtils']).controller('CreateController', CreateController);

    function CreateController($rootScope, $scope, $document, $filter, filterCompare, greaterThanZeroIntPattern, greaterThanZeroAllPattern) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {
            $mainCtrl.nameSortFlag = 1;
            $mainCtrl.totalFundsSortFlag = 1;
            $mainCtrl.expDateSortFlag = 1;
            $mainCtrl.sweepDateSortFlag = 1;

            ctrl.greaterThanZeroIntPattern = greaterThanZeroIntPattern;            
            ctrl.showAddNewProject = false;
            ctrl.newProject = {
                numAddr: 0,
                addrAmt: 0,
                qrCode: true,
                walletIns: true,
                autoSweep: false,
                sweepDate: '',
                fundsSwept: false,
                allClaimed: false,
                projectFunded: false,
                fundsSent: false
            };
            
            ctrl.expCalendar = {
                opened: false
            };
            ctrl.sweepCalendar = {
                opened: false
            };
            ctrl.datepickerOptions = {
                showWeeks: false
            };
            ctrl.datepickerFormat = "MM/dd/yyyy";
            ctrl.today = new Date();
            
            ctrl.availableProjects = [];
            
            // load all projects
            if (angular.isArray(electron.remote.getGlobal('availableProjects').list))
                ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
            
            $mainCtrl.setPageHeight();
        };
        
        // reload projects when there have been changes
        ipcRenderer.on('projectsReady', (event, args) => {            
            $scope.$apply(function() {
                ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                console.log(ctrl.availableProjects);

                // display the project list as 10 per page?

                $mainCtrl.setPageHeight();
            });
        });
        
        /* Is the calendar date in the future? */
        ctrl.checkCalendarDate = function(type) {
            var input;
            var value;
            
            if (type === "expCalendar") {
                input = $scope.addNewProjectForm.expDate;
                value = ctrl.newProject.expDate;
            }
            else if (type === "sweepCalendar") {
                input = $scope.addNewProjectForm.sweepDate;
                value = ctrl.newProject.sweepDate;
            }
            
            if (value > ctrl.today)
                input.$setValidity('invalidDate', true);
            else
                input.$setValidity('invalidDate', false);
        };
        
        /* Create sender addresses for a project. */
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
                        $scope.$apply(function() {
                            console.log('addressesCreated');
                            ctrl.newProject = {};
                            form.$setPristine();
                            form.$setUntouched();
                            form.$submitted = false;
                            ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                            
                            ipcRenderer.send('showInfoDialog', {title: 'Receiver addresses', body: 'Addresses were created successfully.'});
                        });
                    });
                }
            });
            
            form.$submitted = true;
            if (form.$valid) {
                ctrl.newProject.numAddr = parseInt(ctrl.newProject.numAddr);
                ctrl.newProject.recvAddrs = [];
                
                ipcRenderer.send('setReferrer', {referrer: 'createAddresses'});
                ipcRenderer.send('showConfirmationDialog', {title: 'Create receiver addresses?', body: 'Are you sure you want to create receiver addresses for this project?'});
            }
        };

        /* Delete a project. */
        ctrl.delete = function(id) {
            ctrl.activeProjectID = id;
            
            ipcRenderer.send('setReferrer', {referrer: 'deleteProject'});
            ipcRenderer.send('showConfirmationDialog', {title: 'Delete project?', body: 'Are you sure you want to delete this project? All keys will be deleted and the process is irreversible.'});
            
            ipcRenderer.on('dialogYes', (event, arg) => {
                if (electron.remote.getGlobal('referrer') !== "deleteProject")
                    return;
                
                ipcRenderer.send('deleteProject', {id: id});
            });
        };

        /* Load a modal used to edit a project. */
        ctrl.edit = function(id) {
            ctrl.showAddNewProject = false;
            ctrl.activeProjectID = id;
            ctrl.activeProject = $filter('filter')(ctrl.availableProjects, {id: id}, filterCompare)[0];

            console.log(ctrl.activeProject);
            
            ipcRenderer.send('setReferrer', {referrer: 'createPage'});
            ipcRenderer.send('editProject', {project: ctrl.activeProject});
        };

        /* Create a new project. */
        ctrl.new = function(form) {
            ctrl.newProject.numAddr = parseInt(ctrl.newProject.numAddr);
            ctrl.newProject.recvAddrs = [];
            
            ipcRenderer.send('newProject', {newProject: ctrl.newProject});
            ipcRenderer.on('newProjectAdded', (event, arg) => {
                $scope.$apply(function() {
                    console.log('newProjectAdded');
                    ctrl.newProject = {};
                    ctrl.newProject.qrCode = true;
                    ctrl.newProject.walletIns = true;
                    form.$setPristine();
                    form.$setUntouched();
                    form.$submitted = false;
                });
            });
        };
        
        /* Open the calendar popup. */
        ctrl.openCalendar = function(type) {
            if (type === "expCalendar")
                ctrl.expCalendar.opened = true;
            else if (type == "sweepCalendar")
                ctrl.sweepCalendar.opened = true;
        };
        
        /* Called when the "create project" button is clicked. */
        ctrl.showAddForm = function() {
            ctrl.showAddNewProject = !ctrl.showAddNewProject;
            
            if (ctrl.showAddNewProject)
                $document.find('#page-wrapper').css('height', '');
            else
                $mainCtrl.setPageHeight();
        };

        /* Sort the project list. */
        ctrl.sort = function(type, reverse = false) {
            ctrl.sortOptions.property = type;
            ctrl.sortOptions.reverse = reverse;
        };
    }
})();