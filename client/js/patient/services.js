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
            'starting': 1,
            'new': 2,
            'active': 3,
            'inactive': 4
        };

        return freshness[this.getStatus()];
    }

    Patient.prototype.getInvoiceSettings = function()
    {
        if (this.invoice) return this.invoice;
        else return {};
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

