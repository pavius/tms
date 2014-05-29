angular.module('tms.common.filters', [])

.filter('checkmark', function()
{
    return function(value)
    {
        return value ? "<img class='glyphicon glyphicon-ok'/>" : 'moo';
    };
});
