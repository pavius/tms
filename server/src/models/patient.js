var _ = require('underscore');
var mongoose = require('mongoose');
var Appointment = require('./appointment');
var Payment = require('./payment');

var patientSchema = mongoose.Schema
({
    name: {type: String, required: true},
    email: {type: String},
    primaryPhone: {type: String},
    appointmentPrice: {type: Number, min: 0, default: 380},
    appointments: [Appointment.schema],
    payments: [Payment.schema],
    status: {type: String, enum: ['starting', 'new', 'active', 'inactive', 'unknown'], default: 'starting'},
    manualStatus: {type: String, enum: ['undefined', 'starting', 'new', 'active', 'inactive', 'recalculate'], default: 'undefined'},
    inactivityReason: {type: String, enum: ['undefined', 'completed', 'terminated'], default: 'undefined'},
    followup: {type: String, enum: ['none', 'random'], default: 'none'},
    appointmentReminders: {type: String, enum: ['none', 'sms', 'email', 'smsAndEmail'], default: 'sms'},
    debt:
    {
        total: {type: Number, min: 0, default: 0},
        oldestNonPaidAppointment: {type: Date}
    },
    lastContact: {type: Date, default: Date.now()},
    bank:
    {
        name: {type: String},
        branch: {type: String},
        account: {type: String}
    },
    invoice:
    {
        recipient: {type: String},
        item: {type: String}
    }
});

// calculate new status
patientSchema.methods.calculateStatus = function()
{
    var status = 'undefined';

    if (this.appointments.length === 0)
    {
        // no appointments means the patient is "new"
        status = 'new';
    }
    else
    {
        // get appointments, sorted by date (newest first)
        appointments = _.sortBy(this.appointments,
                                function(a)
                                {
                                    return a.when
                                }).reverse();

        var weekInMs = 7 * 24 * 60 * 60 * 1000;
        var lastAppointmentMsAgo = (Date.now() - Date.parse(appointments[0].when));

        // is the newest appointment older than eight weeks?
        if (lastAppointmentMsAgo >= (8 * weekInMs))
        {
            // inactive patient
            status = 'inactive';
        }
        else
        {
            // a "new" status can only be maintained, once it's lost it can't be re-attained. to maintain being a new
            // patient you need to have less than 7 appointments and the last appointment must be 2 weeks ago
            if (appointments.length <= 7 &&
                lastAppointmentMsAgo <= (2 * weekInMs) &&
                (this.status == 'new' || this.status == 'starting'))
            {
                status = (appointments.length <= 2 ? 'starting' : 'new');
            }
            else
            {
                status = 'active';
            }
        }
    }

    return status;
};

// get unpaid appointments
patientSchema.methods.getUnpaidAppointments = function()
{
    // get all unpaid appointments
    unpaidAppointments = _.filter(this.appointments, function (appointment)
    {
        return appointment.payment === null;
    });

    // sort the unpaid appointments by date
    unpaidAppointments = _.sortBy(unpaidAppointments, function (appointment)
    {
        return appointment.when;
    });

    return unpaidAppointments;
}

// calculate new debt
patientSchema.methods.calculateDebt = function()
{
    var total = 0;

    // get unpaid appointments
    unpaidAppointments = this.getUnpaidAppointments();

    // if there are any unpaid appointments, sum up their price into the debt this scum owes us
    if (unpaidAppointments.length)
    {
        unpaidAppointments.forEach(function(appointment)
        {
            // if the appointment happened, we need de monies for it
            if (appointment.when <= Date.now())
                total += appointment.price;
        });

        return {total: total, oldestNonPaidAppointment: unpaidAppointments[0].when};
    }
    else
    {
        // no debt
        return {total: 0, oldestNonPaidAppointment: null};
    }
};

module.exports = mongoose.model('Patient', patientSchema);
