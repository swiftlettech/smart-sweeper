'use strict';

angular.module('SmartSweeper')
/*.directive('calculateTotalFunds', function() {
    return {
        require: 'ngModel',
		link: function(scope, element, attrs, ngModel) {
            console.log(scope.newProject.addrAmt);
            console.log(scope.newProject.numAddr);
            console.log(scope.newProject.addrAmt * scope.newProject.numAddr);
			return scope.newProject.addrAmt * scope.newProject.numAddr;
		}
    };
})*/
.directive('convertToNumber', function() {
    /* from : https://docs.angularjs.org/api/ng/directive/select#binding-select-to-a-non-string-value-via-ngmodel-parsing-formatting */
    return {
        require: 'ngModel',
		link: function(scope, element, attrs, ngModel) {
			ngModel.$parsers.push(function(val) {
				return parseInt(val, 10);
			});
			ngModel.$formatters.push(function(val) {
				return '' + val;
			});
		}
    };
});