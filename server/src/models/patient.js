var mongoose = require('mongoose');
var Payment = require('./appointment');
var Appointment = require('./payment');

var patientSchema = mongoose.Schema
({
    name: {type: String, required: true},
    email: {type: String, required: true},
    primaryPhone: {type: String},
    appointmentPrice: {type: Number, min: 0, default: 330},
    appointments: [Appointment.schema],
    payments: [Payment.schema]
});

module.exports = mongoose.model('Patient', patientSchema);
