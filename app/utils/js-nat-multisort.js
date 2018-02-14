/*
 * Angular directive that naturally sorts a simple array or array of objects by a property - Version 0.1.0 - Released under MIT license
 * Author: Miyako Jones (based on javascript-natural-sort by Jim Palmer)
 */
angular.module('mj.jsNatMultisort', [])
.directive('jsMultisort', function() {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: {
            post: function(scope, elem, attrs, ngModel) {
                var array;
                var arrayString;

                if (attrs.ngOptions !== undefined) {
                    arrayString = attrs.ngOptions.slice(attrs.ngOptions.indexOf('in')+3);
                    array = eval('scope.' + arrayString);
                }
                else if (attrs.ngRepeat !== undefined) {
                    arrayString = attrs.ngRepeat.slice(attrs.ngRepeat.indexOf('in')+3);
                    arrayString = arrayString.substring(arrayString, arrayString.indexOf(' '));
                    
                    if (arrayString.indexOf('$') == -1)
                        array = eval('scope.' + arrayString);
                    else
                        array = arrayString;
                    
                    console.log(array);
                }
                else {
                    array = eval('scope.' + attrs.ngModel);
                }

                ngModel.$formatters.push(function(val) {
                    var options = attrs.jsMultisort;

                    if (options === "") {
                        options = {};
                    }
                    else {
                         if (arrayString.indexOf('$') == -1)
                            options = eval('scope.' + attrs.jsMultisort);
                        else
                            options = eval(attrs.jsMultisort);
                    }

                    options.array = array;
                    console.log(options);

                    jsMultisort(options);

                    function jsMultisort(options) {
                        options = options === undefined ? {} : options;    
                        var array = options.array === undefined ? undefined : options.array;
                        var property = options.property === undefined ? undefined : options.property;
                        var insensitive = options.insensitive === undefined ? false : options.insensitive;
                        var reverse = options.reverse === undefined ? false : options.reverse;

                        function naturalSort(a, b) {
                            if (property !== undefined) {
                                a = a[property];
                                b = b[property];
                            }

                            var re = /(^([+\-]?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?(?=\D|\s|$))|^0x[\da-fA-F]+$|\d+)/g,
                                sre = /^\s+|\s+$/g,   // trim pre-post whitespace
                                snre = /\s+/g,        // normalize all whitespace to single ' ' character
                                dre = /(^([\w ]+,?[\w ]+)?[\w ]+,?[\w ]+\d+:\d+(:\d+)?[\w ]?|^\d{1,4}[\/\-]\d{1,4}[\/\-]\d{1,4}|^\w+, \w+ \d+, \d{4})/,
                                hre = /^0x[0-9a-f]+$/i,
                                ore = /^0/,
                                i = function(s) {
                                    return (naturalSort.insensitive && ('' + s).toLowerCase() || '' + s).replace(sre, '');
                                },
                                // convert all to strings strip whitespace
                                x = i(a),
                                y = i(b),
                                // chunk/tokenize
                                xN = x.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
                                yN = y.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
                                // numeric, hex or date detection
                                xD = parseInt(x.match(hre), 16) || (xN.length !== 1 && Date.parse(x)),
                                yD = parseInt(y.match(hre), 16) || xD && y.match(dre) && Date.parse(y) || null,
                                normChunk = function(s, l) {
                                    // normalize spaces; find floats not starting with '0', string or 0 if not defined (Clint Priest)
                                    return (!s.match(ore) || l == 1) && parseFloat(s) || s.replace(snre, ' ').replace(sre, '') || 0;
                                },
                                oFxNcL, oFyNcL;
                            // first try and sort Hex codes or Dates
                            if (yD) {
                                if (xD < yD) { return -1; }
                                else if (xD > yD) { return 1; }
                            }
                            // natural sorting through split numeric strings and default strings
                            for(var cLoc = 0, xNl = xN.length, yNl = yN.length, numS = Math.max(xNl, yNl); cLoc < numS; cLoc++) {
                                oFxNcL = normChunk(xN[cLoc] || '', xNl);
                                oFyNcL = normChunk(yN[cLoc] || '', yNl);
                                // handle numeric vs string comparison - number < string - (Kyle Adams)
                                if (isNaN(oFxNcL) !== isNaN(oFyNcL)) {
                                    return isNaN(oFxNcL) ? 1 : -1;
                                }
                                // if unicode use locale comparison
                                if (/[^\x00-\x80]/.test(oFxNcL + oFyNcL) && oFxNcL.localeCompare) {
                                    var comp = oFxNcL.localeCompare(oFyNcL);
                                    return comp / Math.abs(comp);
                                }
                                if (oFxNcL < oFyNcL) { return -1; }
                                else if (oFxNcL > oFyNcL) { return 1; }
                            }
                        }

                        if (options !== undefined) {
                            if (insensitive)
                                naturalSort.insensitive = true;

                            array.sort(naturalSort);

                            if (reverse)
                                array.reverse();
                        }

                        return array;
                    }
                });
            }
        }
    };
});