(function() {
    'use strict';

    angular.module('SmartSweeperUtils')
    .directive('convertToNumber', function() {
        /* from: https://docs.angularjs.org/api/ng/directive/select#binding-select-to-a-non-string-value-via-ngmodel-parsing-formatting */
        return {
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {
                ngModel.$parsers.push(function(val) {
                    console.log('val: ', val);
                    
                    if (val.indexOf('.') != -1)
                        return parseFloat(val);
                    else
                        return parseInt(val, 10);
                });
                ngModel.$formatters.push(function(val) {
                    return '' + val;
                });
            }
        };
    })
    .filter('hidePrivateKey', function() {
        // shows/hides a project's private key
        return function(privateKey, flag) {
            if (!flag || flag === undefined)
                return "******";
            else
                return privateKey;
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
    /*.filter('smartCalc', function() {
        // 
        return function(amt) {
            return parseFloat(amt);
        };
    })*/
    .filter('toFixedNum', function() {
        /* Formats a number to a fixed number of decimals. */
        return function(value, decimals) {            
            if (value !== undefined && typeof value !== "string") {
                if (decimals === undefined)
                    decimals = 0;

                return value.toFixed(decimals);
            }
            else if (typeof value === "string")
                return value;
            else
                return "";
        };
    });
})();