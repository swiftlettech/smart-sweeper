angular.module('SmartSweeper').component('sweepTab', {
    templateUrl: 'app/sweep/sweep.html',
    controller: SweepController,
    bindings: {
        
    }
});

function SweepController($scope, $document) {
    var ctrl = this;
    
    this.$onInit = function() {
		
	};
    
    //TODO: return funds back to project address after expiration date
}