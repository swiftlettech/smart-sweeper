(function() {
    'use strict';

    angular.module('SmartSweeper.sweep', []).controller('SweepController', SweepController);

    function SweepController($scope, $document, $interval, $filter, filterCompare) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        var $mainCtrl = $scope.$parent.$mainCtrl;
        
        var ctrl = this;

        $scope.init = function() {
            $mainCtrl.nameSortFlag = 1;
            $mainCtrl.totalFundsSortFlag = 1;
            $mainCtrl.percentClaimedSortFlag = 1;
            $mainCtrl.sweepDateSortFlag = 1;
            
            /* some form code from: http://embed.plnkr.co/ScqA4aqno5XFSp9n3q6d */
            ctrl.disableChecks = false;
            ctrl.projectsToSweep = {};
            ctrl.projectsToSweepCount = 0;
            ctrl.formData = {
                projectsToSweep: ctrl.projectsToSweep
            };
            
            // load all projects
            if (angular.isArray(electron.remote.getGlobal('availableProjects').list)) {
                ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                //ctrl.availableProjectsCopy = angular.copy(ctrl.availableProjects);
                
                ctrl.showSpinner = []
                for (var i=0; i<ctrl.availableProjects.length; i++) {
                    ctrl.showSpinner.push(false);
                }
            }
            
            // reload status spinners if a sweep is already in progress
            ctrl.taskStatusData = $mainCtrl.getTaskStatusData('sweepFunds');
            if (ctrl.taskStatusData) {
                angular.forEach(ctrl.taskStatusData, function(checkedProject, key) {
                    if (checkedProject)
                        ctrl.showSpinner[parseInt(key)] = true;
                });
            }
            
            ipcRenderer.on('taskStatusCheckDone', (event, args) => {
                ipcRenderer.removeAllListeners('taskStatusCheckDone');
                $scope.$apply(function() {
                    console.log(args);
                    if (args.function === "sweepFunds" && (args.status == true || args.error == true)) {
                        $interval.cancel(ctrl.taskStatusCheck);
                        
                        for (var i=0; i<ctrl.showSpinner.length; i++) {
                            ctrl.showSpinner[i] = false;
                        }
                    }
                });
            });
            
            ipcRenderer.on('toggleProgressSpinner', (event, args) => {
                $scope.$apply(function() {
                    var toggle = args.status;

                    if (args.function === "fundsSwept") {

                    }
                });
            });
            
            ipcRenderer.on('fundsSwept', (event, args) => {
                $scope.$apply(function() {
                    // reset form
                    $scope.sweepForm.$setPristine();
                    $scope.sweepForm.$setUntouched();
                    ctrl.projectsToSweep = [];
                    
                    ctrl.disableChecks = false;
                    for (var i=0; i<ctrl.showSpinner.length; i++) {
                        ctrl.showSpinner[i] = false;
                    }
                    $mainCtrl.setTaskStatusData(null);
                    $mainCtrl.setModalMsg(args.msgType, args.msg);
                });
            });
        };
        
        // reload projects when there have been changes
        ipcRenderer.on('projectsReady', (event, args) => {            
            $scope.$apply(function() {
                ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                //ctrl.availableProjectsCopy = angular.copy(ctrl.availableProjects);
                // display the project list as 10 per page?
            });
        });
        
        /* Update the total number of projects selected. */
        ctrl.checkboxChanged = function() {
            ctrl.projectsToSweepCount = Object.keys(ctrl.projectsToSweep).some(function (key) {
                return ctrl.projectsToSweep[key];
            });
        };
        
        /* Load a modal used to edit a project. */
        ctrl.edit = function(id) {
            ctrl.activeProjectID = id;
            ctrl.activeProject = $filter('filter')(ctrl.availableProjects, {id: id}, filterCompare)[0];
            
            ipcRenderer.send('setReferrer', {referrer: 'sweepPage'});
            ipcRenderer.send('editProject', {project: ctrl.activeProject});
        };
        
        /* Return funds back to project address manually after expiration date. (single project sweeping) */
        ctrl.sweep = function(projectID) { 
            ipcRenderer.send('setReferrer', {referrer: 'sweepFunds'});
            ipcRenderer.send('showConfirmationDialog', {title: 'Sweep funds?', body: 'Are you sure you want to sweep promo funds back to the project wallet?'});
            
            ipcRenderer.on('dialogYes', (event, arg) => {
                if (electron.remote.getGlobal('referrer') !== "sweepFunds")
                    return;
                
                var projectIDs = [];
                projectIDs.push(projectID);
                ctrl.projectsToSweep = [];

                var obj = {};
                obj[projectID] = true;
                ctrl.projectsToSweep.push(obj);
                ctrl.showSpinner[projectID] = true;

                $mainCtrl.setTaskStatusData('sweepFunds', ctrl.projectsToSweep);
                ipcRenderer.send('sweepFunds', {projectIDs: projectIDs});

                // status checking
                ctrl.taskStatusCheck = $interval(function() {
                    console.log('checking task status');
                    ipcRenderer.send('taskStatusCheck', 'sweepFunds');
                }, 5000);
            });
        };
        
        /* Return funds back to project address manually after expiration date. (multi-project sweeping) */
        /*ctrl.sweep = function() {
            var projectIDs = [];
            
            angular.forEach(ctrl.projectsToSweep, function(checkedProject, key) {
                if (checkedProject) {
                    projectIDs.push(parseInt(key));
                    ctrl.showSpinner[parseInt(key)] = true;
                }
            });
            
            // disable checkboxes while sweeping
            ctrl.disableChecks = true;
            
            $mainCtrl.setTaskStatusData('sweepFunds', ctrl.projectsToSweep);
            ipcRenderer.send('sweepFunds', {projectIDs: projectIDs});
            
            // status checking
            ctrl.taskStatusCheck = $interval(function() {
                console.log('checking task status');
                ipcRenderer.send('taskStatusCheck', 'sweepFunds');
            }, 5000);
        };*/
    }
})();