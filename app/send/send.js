angular.module('SmartSweeper').component('sendTab', {
    templateUrl: 'app/send/send.html',
    controller: SendController,
    controllerAs: '$sendCtrl',
    bindings: {
        ipcRenderer: '<'
    }
});

function SendController($scope, $document, $filter) {
    const {ipcRenderer} = window.nodeRequire('electron');
    var ctrl = this;
    
    this.$onInit = function() {
        ctrl.showAddNewProject = false;
        ctrl.newProject = {};
		ctrl.nameSortFlag = 1;
        ctrl.expSortFlag = -1;
        
        ctrl.datepickerOptions = {
            showWeeks: false
        };
        ctrl.datepickerFormat = "MM/dd/yyyy";
        
        // load all projects
        ipcRenderer.send('getProjects');
        ipcRenderer.on('projectsReady', (event, arg) => {
            $scope.$parent.setAvailableProjects(arg.list);
            ctrl.availableProjects = arg.list;
            console.log();
        });
	};
    
    ctrl.delete = function(id) {
        ctrl.activeProjectID = id;
        ipcRenderer.send('deleteProject', {id: id});
    };
    
    ctrl.edit = function(id) {
        ctrl.activeProjectID = id;
        ctrl.activeProject = $filter('filter')(ctrl.availableProjects, {id: id})[0];
        
        console.log(ctrl.activeProject);
        
        localStorage.projectId = ctrl.activeProject.id;
        localStorage.projectName = ctrl.activeProject.name;
        localStorage.projectDesc = ctrl.activeProject.desc;
        localStorage.projectExp = typeof ctrl.activeProject.exp !== "undefined" ? ctrl.activeProject.exp : '';
        localStorage.projectFunds = typeof ctrl.activeProject.funds !== "undefined" ? ctrl.activeProject.funds : '';
        localStorage.projectWalletNum = typeof ctrl.activeProject.numOfWallets !== "undefined" ? ctrl.activeProject.numOfWallets : '';
        localStorage.projectWalletAmt = typeof ctrl.activeProject.amtPerWallet !== "undefined" ? ctrl.activeProject.amtPerWallet : '';
        
        ipcRenderer.send('editProject', {id: id, project: ctrl.activeProject});
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
        console.log(type);
    };
    
    //TODO: edit project form
    //TODO: paper wallet generator
    //TODO: QR code generator
}