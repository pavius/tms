// Declare app level module which depends on filters, and services
angular.module('tms', 
[
    'ngRoute',
    'tms.controllers',
    'tms.services',
    'tms.filters'
]).
config(function ($routeProvider, $locationProvider) 
{
    $routeProvider.
        when('/', 
        {
            templateUrl: 'partials/dashboard',
            controller: 'dashboardController'
        }).
        when('/patients', 
        {
            templateUrl: 'partials/patients',
            controller: 'patientsController'
        }).
        when('/patients/:id', 
        {
            templateUrl: 'partials/patient',
            controller: 'patientController'
        }).
        when('/appointments', 
        {
            templateUrl: 'partials/appointments',
            controller: 'appointmentsController'
        }).
        otherwise
        ({
            redirectTo: '/'
        });

    $locationProvider.html5Mode(true);
});
