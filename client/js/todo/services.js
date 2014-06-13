angular.module('tms.todo.services',
[
    'ngResource',
    'tms.appointment.services',
    'tms.payment.services'
])

.factory('Todo', ['$resource', '$location', 'Appointment', 'Payment',
         function($resource, $location, Appointment, Payment)
{
    //
    // A summary is required for a patient
    //
    function SummarizeAppointmentTodo(patient, appointment)
    {
        this.patient = patient;
        this.appointment = appointment;
        this.done = false;
    }

    SummarizeAppointmentTodo.prototype.complete = function(callback)
    {
        Appointment.update({patientId: this.patient._id, id: this.appointment._id}, {summarySent: true}, function(appointment)
        {
            if (callback) callback();
        });
    }

    SummarizeAppointmentTodo.prototype.view = function(callback)
    {
        $location.path('patients/' + this.patient._id);
    }

    SummarizeAppointmentTodo.prototype.toString = function()
    {
        // get how long ago this appointment was
        function getTimeSinceAppointment(appointment)
        {
            hoursSinceAppointment = (Date.now() - Date.parse(appointment.when)) / (60 * 60 * 1000);

            if (hoursSinceAppointment == 0)
                return "עכשיו";
            else if (hoursSinceAppointment < 24)
                return "היום";
            else if (hoursSinceAppointment < 48)
                return "אתמול";
            else
                return "לפני " + Math.round(hoursSinceAppointment / 24) + " ימים";
        }

        return "ל" + this.patient.name + " פגישה לא מסוכמת מ" + getTimeSinceAppointment(this.appointment);
    }

    //
    // A debt needs to be collected for a patient
    //
    function CollectDebtTodo(patient, debt)
    {
        this.patient = patient;
        this.debt = debt;
        this.done = false;
    }

    CollectDebtTodo.prototype.complete = function(callback)
    {
        if (window.confirm("האם לשלוח חשבונית ל" + this.patient.name + "?"))
        {
            Payment.save({patientId: this.patient._id}, {sum: this.debt.total, when: Date.now()}, function(payment)
            {
                callback();
            });
        }
    }

    CollectDebtTodo.prototype.view = function(callback)
    {
        $location.path('patients/' + this.patient._id);
    }

    CollectDebtTodo.prototype.toString = function()
    {
        function getDaysSinceOldestUnpaidAppointment(debt)
        {
            return Math.floor((Date.now() - Date.parse(debt.oldestNonPaidAppointment)) / (24 * 60 * 60 * 1000));
        }

        return "ל" + this.patient.name + " חוב בן " + getDaysSinceOldestUnpaidAppointment(this.debt) + ' ימים ע"ס ' + this.debt.total + ' ש"ח';
    }


    //
    // Factory object
    //
    return {
        createSummarizeAppointmentTodo: function(patient, appointment) { return new SummarizeAppointmentTodo(patient, appointment); },
        createCollectDebtTodo: function(patient, debt) { return new CollectDebtTodo(patient, debt); }
    }
}]);
