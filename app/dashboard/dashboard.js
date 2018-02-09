angular.module('SmartSweeper').component('dashboardTab', {
    templateUrl: 'app/dashboard/dashboard.html',
    controller: DashboardController,
    bindings: {
        
    }
});

function DashboardController($scope, $document) {
    var ctrl = this;
    
    this.$onInit = function() {
		
	};
    
    //TODO: available balance display
    //TODO: pending display
    //TODO: sent display
}