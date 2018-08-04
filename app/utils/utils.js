(function() {
    'use strict';
    
    const {ipcRenderer} = window.nodeRequire('electron');
    const smartcashapi = window.nodeRequire('./smartcashapi');

    angular.module('SmartSweeperUtils')
    .directive('addrValidation', function() {
        /* Checks to see if a SmartCash address is valid. */
        return {
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {
                ngModel.$validators.addrvalidation = function(modelValue, viewValue) {
                    var value = modelValue || viewValue;                    
                    if (ngModel.$isEmpty(value))
                        return false;
                    
                    return smartcashapi.checkAddress(value);
                }
            }
        };
    })
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
    .directive('enableDeleteBtn', function() {        
        /* Enables project delete button if certain requirements have been met. */
        return {
            link: function(scope, element, attrs) {
                var project = JSON.parse(attrs.enableDeleteBtn);
                //console.log(project.name)
                //console.log(project)
                
                /*
                    conditions (one is true):
                        (1) The project hasn't been funded.
                            (project.txid.length == 0)
                        (2) The project was funded but the balance is now zero (funds were withdrawn from outside the app).
                            (project.txid.length > 0 && project.zeroBalance)
                        (3) Funds have been sent to the promo wallets and all of them have been claimed.
                            (project.fundsSent && project.allClaimed)
                        (4) Funds have been sent to the promo wallets and the project has been swept.
                            (project.fundsSent && project.fundsSwept)
                */
                var enableCond = false;
                
                if (project.txid === undefined || project.txid.length == 0) {
                    // enable delete button if the project hasn't been funded
                    enableCond = true;
                }
                else {
                    // the project has been funded
                    if (project.zeroBalance) {
                        // the project now has a zero balance
                        enableCond = true;
                    }
                    else if (project.fundsSent && project.allClaimed) {
                        // funds have been sent to the promo wallets and all of them have been claimed
                        enableCond = true;
                    }
                    else if (project.fundsSent && project.fundsSwept) {
                        // funds have been sent to the promo wallets and the project was swept
                        enableCond = true;
                    }
                }
                
                if (enableCond) {
                    attrs.disabled = false;
                    attrs.ngDisabled = "false";
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