angular.module('tms.appointment.services', ['ngResource'])

.factory('Appointment', ['$resource', function($resource)
{
    var Appointment = $resource('api/patients/:patientId/appointments/:id', {},
    {
        update: {method:'PUT'}
    });

    return Appointment;
}])

.service('AppointmentModal', ['$modal', function($modal)
{
    function openModal(mode, patient, appointment)
    {
        return $modal.open({templateUrl: './partials/appointment-modal',
            controller: 'AppointmentModalController',
            size: 'sm',
            resolve:
            {
                patient: function() {return patient},
                appointment: function() {return appointment;},
                mode: function() {return mode;}
            }});
    }

    this.create = function(patient, callback)
    {
        // build the default appointment, based on the fact that it belongs to a certain patient
        appointment = {
            when: (new Date()).setMinutes(0),
            type: 'face-to-face',
            payment: null
        };

        // set appointment price if there's a defined patient. Otherwise default to appointment price
        if (patient)
            appointment.price = patient.appointmentPrice;

        // pop up the modal
        appointmentModal = openModal('create', patient, appointment);

        appointmentModal.result.then(function(result)
        {
            if (result.status == 'create')
            {
                callback(result.updatedPatient);
            }
        });
    }

    this.update = function(patient, appointment, updateCallback, deleteCallback)
    {
        // pop up the modal
        appointmentModal = openModal('update', patient, appointment);

        appointmentModal.result.then(function(result)
        {
            if (result.status == 'update')
            {
                updateCallback(result.updatedPatient);
            }
            else if (result.status == 'delete')
            {
                deleteCallback(result.updatedPatient);
            }
        });
    }
}]);
