/* Filters */
var tmsFilters = angular.module('tms.filters', []);

tmsFilters.filter('checkmark', function()
{
    return function(value)
    {
        return value ? "<img class='glyphicon glyphicon-ok'/>" : 'moo';
    };
});
