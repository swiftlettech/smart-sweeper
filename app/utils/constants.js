(function() {
    'use strict';

    angular.module('SmartSweeper')
    .constant('filterCompare', function(actual, expected) {					
        if (actual == expected)
            return true;
        else
            return false;
    });
})();