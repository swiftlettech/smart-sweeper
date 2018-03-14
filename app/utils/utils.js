'use strict';

angular.module('SmartSweeperUtils')
.directive('convertToNumber', function() {
    /* from: https://docs.angularjs.org/api/ng/directive/select#binding-select-to-a-non-string-value-via-ngmodel-parsing-formatting */
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
})
.filter('hasAddresses', function() {
	// returns whether or not a project has receiver addresses created for it
    return function(project) {
        if (project.recvAddrs.length > 0)
            return true;
        else
            return false;
    };
})
.directive('heightBind', function() {
    /* from: https://stackoverflow.com/a/25108855/7843806 */
    return {
        scope: {
            heightValue: '='
        },
        link: function(scope, element) {            
            scope.$watch(function() {
                scope.heightValue = element.height();
                console.log(scope.heightValue);
            });
        }
    }
})
.filter('toFixedNum', function() {
	/* Formats a number to a fixed number of decimals. */
    return function(value, decimals) {
        if (decimals === undefined)
            decimals = 0;
        
        return value.toFixed(decimals);
    };
});