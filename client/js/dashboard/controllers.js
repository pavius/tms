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
    $scope.upcomingAppointments = [];

    $scope.completeTodoAndRemove = function(todo, index)
    {
        if (todo.done)
        {
            todo.complete(function()
            {
                $scope.todos.splice(index, 1);
            });
        }
    }

    // get all active patients
    Patient.query({status: '^active|new'}, function(patients)
    {
        patients.forEach(function (patient)
        {
            patient.appointments.forEach(function (appointment)
            {
                // is this an appointment which occurred in teh past?
                if (Date.parse(appointment.when) <= Date.now())
                {
                    // is it unsummarized?
                    if (!appointment.summarySent)
                        $scope.todos.push(Todo.createSummarizeAppointmentTodo(patient, appointment));
                }
                // future appointment
                else
                {
                    // is it within 7 days from now?
                    if ((Date.parse(appointment.when) - Date.now()) < (7 * 24 * 60 * 60 * 1000))
                    {
                        appointment.patient = patient;
                        $scope.upcomingAppointments.push(appointment);
                    }
                }
            });
        });
    });
}]);