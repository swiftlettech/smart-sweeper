angular.module('SmartSweeper').component('logTab', {
    templateUrl: 'app/log/log.html',
    controller: LogController
});

function LogController($scope, $document) {
    var ctrl = this;
    
    this.$onInit = function() {
		
	};
    
    //TODO: list all transactions, most recent first
    //TODO: allow the user to filter transactions by keyword
}