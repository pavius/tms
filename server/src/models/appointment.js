var mongoose = require('mongoose');

var appointmentSchema = mongoose.Schema
({
    patient: {type: mongoose.Schema.ObjectId, ref: 'Patient', required: true},
    when: Date,
    summary: String,
    summarySent: {type: Boolean, default: false},
    missed: {type: Boolean, default: false},
    price: {type: Number, min: 0, default: 330},
    payment: {type: mongoose.Schema.ObjectId, ref: 'Payment'}
});

module.exports = mongoose.model('Appointment', appointmentSchema);
