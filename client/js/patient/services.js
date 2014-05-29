angular.module('tms.patient.services', ['ngResource'])

.factory('Patient', ['$resource', function($resource)
{
    var Patient = $resource('api/patients/:id', {}, 
    {
        update: {method:'PUT'}
    });

    return Patient; 
}]);
