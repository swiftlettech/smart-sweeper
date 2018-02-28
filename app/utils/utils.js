'use strict';

angular.module('SmartSweeper')
.directive('calculateTotalFunds', function() {
    return {
        require: 'ngModel',
		link: function(scope, element, attrs, ngModel) {
            ngModel.$formatters.push(function(val) {
				//console.log(scope.newProject.addrAmt);
                //console.log(scope.newProject.numAddr);
                //console.log(scope.newProject.addrAmt * scope.newProject.numAddr);
                if (scope.newProject !== undefined)
                    return scope.newProject.addrAmt * scope.newProject.numAddr;
                else
                    return 0;
			});
		}
    };
})
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

        console.log(scope);

        //$document.find('.scrollbox').css('height', '');

        // from: https://stackoverflow.com/a/5038256/7843806
        if (!(scrollbox.scrollHeight > scrollbox.clientHeight))
            $document.find('#tableHeading .scrollCol').css('display', 'none');
        //else
            //$document.find('#tableHeading .scrollCol').css('width', '1px');
    }
});