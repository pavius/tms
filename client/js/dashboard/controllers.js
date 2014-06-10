angular.module('tms.dashboard.controllers', 
[
    'tms.appointment.services'
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
            ['$scope', '$location', 'Appointment', 
            function($scope, $location, Appointment) 
{
    function getPatientsRequiringSummary(callback)
    {
        resultList = {};

        Appointment.query({
                              'when': '{lte}' + Date.now(), 
                              'summarySent': false,
                              'missed': false, 
                              'populate_patient': true
                          }, 
        function(appointments)
        {
            appointments.forEach(function(appointment)
            {
                patient = appointment.patient;

                // was this patient already added?
                if (!resultList.hasOwnProperty(patient._id))
                {
                    resultList[patient._id] = {name: patient.name, appointments: 1};
                }
                else
                {
                    // add to # of appointments
                    resultList[appointment.patient._id].appointments++;
                }
            });

            // done
            callback(resultList);
        });
    }

    function getAppointmentsComingUp(callback)
    {
        cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + 7);

        Appointment.query({
                              'when': '{gte}' + Date.now() + '{lte}' + cutoffDate.getTime(), 
                              'populate_patient': true
                          }, 
        function(appointments)
        {
            // done
            callback(appointments);
        });
    }

    $scope.patientsWithUnsummarizedAppointments = {};
    $scope.appointmentsComingUp = [];
}]);