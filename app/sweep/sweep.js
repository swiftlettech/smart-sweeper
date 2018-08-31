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
                
                ctrl.showSpinner = new Array(ctrl.availableProjects.length);
                for (var i=0; i<ctrl.showSpinner.length; i++) {
                    ctrl.showSpinner[i] = false;
                }
            }
            
            //$mainCtrl.setPageHeight();
        };
        
        // reload projects when there have been changes
        ipcRenderer.on('projectsReady', (event, args) => {            
            $scope.$apply(function() {
                ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
                //ctrl.availableProjectsCopy = angular.copy(ctrl.availableProjects);
                console.log(ctrl.availableProjects);
                // display the project list as 10 per page?

                //$mainCtrl.setPageHeight();
            });
        });
        
        /* Funds that have been transferred from a promotional wallet to a different wallet (per project). */
        /*function claimedFunds(projectID, index) {
            ipcRenderer.send('getClaimedFundsInfo', {projectID: projectID, type: 'receivers'});
            ipcRenderer.on('claimedFundsInfo', (event, args) => {
                $scope.$apply(function() {
                    var project = ctrl.availableProjectsCopy[index];
                    
                    project.claimedAddrTotal = args.claimedWallets;
                    project.percentClaimed = args.claimedWallets / project.recvAddrs.length;
                    if (Number.isNaN(project.percentClaimed)) { project.percentClaimed = 0; }
                });
            });
        }*/
        
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
        
        /* Return funds back to project address manually after expiration date. */
        ctrl.sweep = function() {
            var projectIDs = [];
            
            angular.forEach(ctrl.projectsToSweep, function(checkedProject, key) {
                if (checkedProject) {
                    projectIDs.push(parseInt(key));
                    ctrl.showSpinner[parseInt(key)] = true;
                }
            });
            
            // disable checkboxes while sweeping
            ctrl.disableChecks = true;
            
            ipcRenderer.send('sweepFunds', {projectIDs: projectIDs});
            
            // status checking
            /*var taskStatusCheck = $interval(function() {
                console.log('checking task status');
                ipcRenderer.send('taskStatusCheck', 'sweepFunds');
            }, 5000);
            
            ipcRenderer.on('taskStatusCheckDone', (event, args) => {
                console.log(args);
                if (args.function === "sweepFunds" && (args.status == true || args.error == true)) {
                    $interval.cancel(taskStatusCheck);
                }
                else {
                    angular.forEach(ctrl.projectsToSweep, function(checkedProject, key) {
                        if (checkedProject) {
                            ctrl.showSpinner[parseInt(key)] = true;
                        }
                    });
                }
            });*/
            
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
                    $mainCtrl.setModalMsg(args.msgType, args.msg);
                });
            });
        };
    }
})();