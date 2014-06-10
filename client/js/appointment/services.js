angular.module('tms.appointment.services', ['ngResource'])

.factory('Appointment', ['$resource', function($resource)
{
    var Appointment = $resource('api/patients/:patientId/appointments/:id', {},
    {
        update: {method:'PUT'}
    });

    return Appointment;
}]);
