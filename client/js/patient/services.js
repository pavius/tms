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

    Patient.prototype.getStatus = function()
    {
        if (this.manualStatus == 'undefined' || this.manualStatus == 'recalculate')
            return this.status;
        else
            return this.manualStatus;
    }

    Patient.prototype.getFreshness = function()
    {
        var freshness = {
            'new': 1,
            'active': 2,
            'inactive': 3
        };

        return freshness[this.getStatus()];
    }

    return Patient;
}])

.factory('PatientsService', function()
{
    var service =
    {
        configuration:
        {
            filterType: 'active'
        }
    };

    return service;
});

