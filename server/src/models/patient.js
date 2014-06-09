var _ = require('underscore');
var mongoose = require('mongoose');
var Appointment = require('./appointment');
var Payment = require('./payment');

var patientSchema = mongoose.Schema
({
    name: {type: String, required: true},
    email: {type: String, required: true},
    primaryPhone: {type: String},
    appointmentPrice: {type: Number, min: 0, default: 330},
    appointments: [Appointment.schema],
    payments: [Payment.schema],
    status: {type: String, enum: ['new', 'active', 'inactive', 'unknown'], default: 'new'},
    manualStatus: {type: String, enum: ['undefined', 'inactive', 'unknown'], default: 'undefined'}
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
        // get appointments, sorted by date
        appointments = _.sortBy(this.appointments, function(a) {return a.when});

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

module.exports = mongoose.model('Patient', patientSchema);