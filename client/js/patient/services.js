angular.module('tms.patient.services', ['ngResource'])

.factory('Patient', ['$resource', function($resource)
{
    var Patient = $resource('api/patients/:id', {}, 
    {
        update: {method:'PUT'}
    });

    Patient.prototype.isActive = function()
    {
        return this.status == 'new' || this.status == 'active';
    }

    return Patient; 
}]);
