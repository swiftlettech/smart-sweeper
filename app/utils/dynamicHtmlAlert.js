/* From: http://plnkr.co/edit/bJPEyfkKsertulTN7rWp?p=preview */
(function() {
    'use strict';
  
    var app = angular.module('SmartSweeper');
	app.directive('dynamicHtmlAlert', function($compile) {
	  return {
		restrict: 'A',
		replace: true,
		link: function (scope, ele, attrs) {
		  scope.$watch(attrs.dynamicHtmlAlert, function(html) {
			ele.html(html);
			$compile(ele.contents())(scope);
		  });
		}
	  };
	});
})();