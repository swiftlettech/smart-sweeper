(function() {
    'use strict';
    
    const {ipcRenderer} = window.nodeRequire('electron');

    angular.module('SmartSweeperUtils')
    .directive('calcNumber', function() {
        /* Convert to a number to be used in a calculation.
           based on https://docs.angularjs.org/api/ng/directive/select#binding-select-to-a-non-string-value-via-ngmodel-parsing-formatting */
        return {
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {                
                ngModel.$parsers.push(function(val) {                    
                    if (val.indexOf('.') != -1)
                        return parseFloat(val);
                    else {
                        if (val === "")
                            val = 0;
                        
                        return parseInt(val);
                    }
                });
            }
        };
    })
    .directive('convertToNumber', function() {
        /* Convert to a number for display only.
           from: https://docs.angularjs.org/api/ng/directive/select#binding-select-to-a-non-string-value-via-ngmodel-parsing-formatting */
        return {
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {
                ngModel.$parsers.push(function(val) {
                    //console.log('val: ', val);
                    
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
    .directive('addrValidation', function($q) {
        /* Checks to see if a SmartCash address is valid. */
        return {
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {                
                ngModel.$asyncValidators.addrvalidation = function(modelValue, viewValue) {
                    var value = modelValue || viewValue;                    
                    if (ngModel.$isEmpty(value))
                        return $q.reject();
                    
                    ipcRenderer.send('checkAddress', {address: value});
                    ipcRenderer.on('addressChecked', (event, arg) => {
                        console.log(arg.result)
                        //console.log(promise)
                        
                        //scope.$apply(function() {
                            if (arg.result)
                                return $q.resolve();
                            else
                                return $q.reject();
                        //});
                        
                        /*scope.$apply(function() {
                            promise.then(function resolved() {
                                console.log('promise resolved');
                            },
                            function rejected() {
                                console.log('promise rejected');
                            });
                            //console.log("args.result: ", args.result);
                            //return args.result;
                        });*/
                    });
                }
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
            if (project.recvAddrs !== undefined && project.recvAddrs.length > 0)
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