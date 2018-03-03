'use strict';

angular.module('SmartSweeperUtils')
/*.directive('calculateAddrFunds', function() {
    return {
        require: 'ngModel',
		link: function(scope, element, attrs, ngModel) {
            console.log(ngModel.$modelValue);
            console.log(ngModel.$viewValue);
            
            ngModel.$formatters.push(function(val) {
				//console.log(scope.newProject.addrAmt);
                //console.log(scope.newProject.numAddr);
                //console.log(scope.newProject.addrAmt * scope.newProject.numAddr);
                
                ngModel.$viewValue = ngModel.$modelValue;
                
                if (scope.$editCtrl.activeProject.totalFunds !== undefined)
                    scope.$editCtrl.activeProject.addrAmt = scope.$editCtrl.activeProject.totalFunds / ngModel.$viewValue;
                else
                    scope.$editCtrl.activeProject.addrAmt = 0;
                
                return ngModel.$viewValue;
			});
		}
    };
})*/
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
.directive('repeatDone', function($document) {
    /* Adjust the table heading if the table body has a scrollbar.
     * Some code from: https://coderwall.com/p/5dpe2w/execute-function-when-ngrepeat-done
     */
    return function(scope, element, attrs) {
        var scrollbox = $document.find('.scrollbox').get(0);

        //console.log(scope);
        //$document.find('.scrollbox').css('height', '');

        // from: https://stackoverflow.com/a/5038256/7843806
        if (!(scrollbox.scrollHeight > scrollbox.clientHeight))
            $document.find('#tableHeading .scrollCol').css('display', 'none');
        //else
            //$document.find('#tableHeading .scrollCol').css('width', '1px');
    }
})
.filter('toFixedNum', function() {
	/* Formats a number to a fixed number of decimals. */
    return function(value, decimals) {
        return value.toFixed(decimals);
    };
});