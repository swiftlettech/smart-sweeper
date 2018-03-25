'use strict';

angular.module('SmartSweeper', [
    'SmartSweeper.dashboard',
    'SmartSweeper.create',
    'SmartSweeper.fund',
    'SmartSweeper.sweep',
    'SmartSweeper.log',
    'SmartSweeper.help',
    'SmartSweeperUtils',
    'ui.bootstrap',
	'ngAnimate',
    'router',
	'ngTouch'
])
.controller('SmartController', function($scope, $document, $filter) {
    const electron = window.nodeRequire('electron');
    
    var ctrl = this;
    
    $scope.init = function() {
		//$document.find('#appAlert, .formAlert').addClass('hide');
        
        /*$(window).on("resize", function(event) {
            ctrl.setPageHeight();
		});*/
        
        ctrl.setActivePage('dashboard');
        ctrl.sortOptions = {property: 'name', reverse: false};
    };
    
    ctrl.setActivePage = function(page) {
        ctrl.activePage = page;
        console.log('active page: ' + ctrl.activePage);
    };
    
    ctrl.setPageHeight = function() {        
        if ((ctrl.activePage === "create" || ctrl.activePage === "fund" || ctrl.activePage === "sweep") && electron.remote.getGlobal('availableProjects').list.length > 7) {
            $document.find('#page-wrapper').css('height', '');
            return;
        }
        
        if (window.innerWidth >= 700 && window.innerHeight >= 600) {
            $document.find('#page-wrapper').css({
                height: function() {
                    return window.innerHeight - (parseInt($document.find('body').css('margin-top'))*2);
                }
            });
        }
    };
    
    /*
     * Natural Sort algorithm for Javascript - Version 0.8.1 - Released under MIT license
     * Author: Jim Palmer (based on chunking idea from Dave Koelle)
     * Slightly modified by Miyako Jones
     */
    ctrl.naturalSort = function(a, b) {
        a = a.value;
        b = b.value;

        var re = /(^([+\-]?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?(?=\D|\s|$))|^0x[\da-fA-F]+$|\d+)/g,
            sre = /^\s+|\s+$/g,   // trim pre-post whitespace
            snre = /\s+/g,        // normalize all whitespace to single ' ' character
            dre = /(^([\w ]+,?[\w ]+)?[\w ]+,?[\w ]+\d+:\d+(:\d+)?[\w ]?|^\d{1,4}[\/\-]\d{1,4}[\/\-]\d{1,4}|^\w+, \w+ \d+, \d{4})/,
            hre = /^0x[0-9a-f]+$/i,
            ore = /^0/,
            i = function(s) {
                return (('' + s).toLowerCase() || '' + s).replace(sre, '');
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
    };
    
    function resetSortFlags() {
        ctrl.nameSortFlag = -1;
        ctrl.sweepDateSortFlag = -1;
    };
    
    ctrl.updateSortOptions = function(property, reverse) {
        ctrl.sortOptions = {property: property, reverse: reverse};
        
        var reverseFlag;
        
        if (reverse)
            reverseFlag = -1;
        else
           reverseFlag = 1; 
        
        resetSortFlags();
        
        if (property === "name")
            ctrl.nameSortFlag = reverseFlag;
        else if (property === "sweepDate")
            ctrl.sweepDateSortFlag = reverseFlag;
    };
});