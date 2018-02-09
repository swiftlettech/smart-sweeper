angular.module('SmartSweeper').component('sendTab', {
    templateUrl: 'app/send/send.html',
    controller: SendController,
    bindings: {
        ipcRenderer: '<'
    }
});

function SendController($scope, $document) {
    const {ipcRenderer} = window.nodeRequire('electron');
    var ctrl = this;
    
    this.$onInit = function() {
        $scope.showAddNewProject = false;
        $scope.newProject = {};
		$scope.nameSortFlag = 1;
        $scope.expSortFlag = -1;
        
        // load all projects
        ipcRenderer.send('getProjects');
        ipcRenderer.on('projectsReady', (event, arg) => {
            $scope.availableProjects = arg.list;
        });
	};
    
    $scope.edit = function(id) {
        $scope.activeProjectID = id;
        ipcRenderer.send('editProject', {id: id});
    };
    
    $scope.delete = function(id) {
        
    };
    
    $scope.new = function(form) {
        ipcRenderer.send('newProject', {newProject: $scope.newProject});
        
        $('#addNewProjectForm')[0].reset()
        form.$setPristine();
        form.$setUntouched();
        form.$submitted = false;
    };
    
    $scope.sort = function(type) {
        console.log(type);
    };
    
    //TODO: project list
    //TODO: edit project form
    //TODO: paper wallet generator
    //TODO: QR code generator
}