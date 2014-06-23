angular.module('tms', 
[
    'ngRoute',
    'ui.select2',
    'tms.common.filters',
    'tms.dashboard.controllers',
    'tms.dashboard.controllers',
    'tms.patient.controllers',
    'tms.appointment.controllers',
    'tms.todo.services'
])

.config(['$routeProvider', '$locationProvider', function ($routeProvider, $locationProvider)
{
    $routeProvider
        
    .otherwise
    ({
        redirectTo: '/'
    });

    $locationProvider.html5Mode(true);
}])

.controller('NavController', 
            ['$scope', '$location', 
            function($scope, $location) 
{
    $scope.isActive = function (viewLocation) 
    {
        var path = $location.path();

        // look for perfect match
        if (viewLocation === path)
        {
            return true;
        }
        // look for imperfect match for non-root
        else if (viewLocation != '/')
        {
            return path.substring(0, viewLocation.length) === viewLocation;
        }
        else return false;
    };    
}]);
