var _ = require('underscore');
var mongoose = require('mongoose');
var Appointment = require('./appointment');
var Payment = require('./payment');

var patientSchema = mongoose.Schema
({
    name: {type: String, required: true},
    email: {type: String},
    primaryPhone: {type: String},
    appointmentPrice: {type: Number, min: 0, default: 330},
    appointments: [Appointment.schema],
    payments: [Payment.schema],
    status: {type: String, enum: ['new', 'active', 'inactive', 'unknown'], default: 'new'},
    manualStatus: {type: String, enum: ['undefined', 'inactive', 'unknown'], default: 'undefined'},
    inactivityReason: {type: String, enum: ['undefined', 'completed', 'terminated'], default: 'undefined'},
    debt:
    {
        total: {type: Number, min: 0, default: 0},
        oldestNonPaidAppointment: {type: Date}
    },
    lastContact: {type: Date, default: Date.now()}
});

// calculate new status
patientSchema.methods.calculateStatus = function()
{
    var status = 'undefined';

    // is there a manual override?
    if (this.manualStatus !== 'undefined')
    {
        status = this.manualStatus;
    }
    else if (this.appointments.length === 0)
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

        // is the newest appointment older than three weeks?
        if (Date.now() - Date.parse(appointments[0].when) >= (3 * 7 * 24 * 60 * 60 * 1000))
        {
            // inactive patient
            status = 'inactive';
        }
        else
        {
            // is there only one appointment? if so, it's a new patient
            if (appointments.length === 1)
            {
                status = 'new';
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
