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
        return value.toFixed(decimals);
    };
});