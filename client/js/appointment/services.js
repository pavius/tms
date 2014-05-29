angular.module('tms.appointment.services', ['ngResource'])

.factory('Appointment', ['$resource', function($resource)
{
    var Appointment = $resource('api/appointments/:id', {}, 
    {
        update: {method:'PUT'}
    });

    return Appointment;
}]);
