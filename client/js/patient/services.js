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

    Patient.prototype.getClass = function()
    {
        status = this.getStatus()

        if (status == 'inactive')
            if (this.followup == 'none')
                status = 'inactive-no-followup';
            else
                status = 'inactive-random-followup';

        return status + '-patient';
    }

    Patient.prototype.getFreshness = function()
    {
        var freshness = {
            'starting-patient': 1,
            'new-patient': 2,
            'active-patient': 3,
            'inactive-random-followup-patient': 4,
            'inactive-no-followup-patient': 5
        };

        return freshness[this.getClass()];
    }

    Patient.prototype.futureAppointmentsCount = function()
    {
        return _.reduce(this.appointments, function(futureAppointments, appointment)
            {
                return (Date.parse(appointment.when) >= Date.now()) ? futureAppointments + 1 : futureAppointments;

            }, 0);
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

