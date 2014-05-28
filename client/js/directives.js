/* Directives */
angular.module('tms.directives', []).
    directive('appVersion', function (version) 
    {
        return function(scope, elm, attrs) 
        {
            elm.text(version);
        };
    });
