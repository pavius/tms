angular.module('tms.dashboard.controllers', 
[
    'tms.patient.services',
    'tms.todo.services'
])

.config(['$routeProvider', function ($routeProvider)
{
    $routeProvider

        .when('/', 
        {
            templateUrl: 'partials/dashboard',
            controller: 'DashboardController'
        });
}]) 

.controller('DashboardController',
            ['$scope', '$location', 'Patient', 'Todo',
            function($scope, $location, Patient, Todo)
{
    $scope.todos = [];

    // get all active patients
    Patient.query({status: '^active|new'}, function(patients)
    {
        patients.forEach(function (patient)
        {
            patient.appointments.forEach(function (appointment)
            {
                // is this an appointment which occurred in teh past and is not summarized?
                if (Date.parse(appointment.when) <= Date.now() && !appointment.summarySent)
                {
                    $scope.todos.push(Todo.createSummarizeAppointmentTodo(patient, appointment));
                }
            });
        });
    });
}]);