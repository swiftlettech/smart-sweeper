(function() {
    'use strict';

    angular.module('SmartSweeperUtils')
    .constant('filterCompare', function(actual, expected) {					
        if (actual == expected)
            return true;
        else
            return false;
    })
    .constant('alertTimeout', 8500)
    .constant('greaterThanZeroIntPattern', '^[1-9][0-9]*$') // https://stackoverflow.com/a/9038554/7843806
    .constant('greaterThanZeroAllPattern', '^(0*[1-9][0-9]*(\.[0-9]+)?|0+\.[0-9]*[1-9][0-9]*)$'); // https://stackoverflow.com/a/9038554/7843806
})();