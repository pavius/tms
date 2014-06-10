var mongoose = require('mongoose');

var appointmentSchema = mongoose.Schema
({
    when: Date,
    summary: String,
    summarySent: {type: Boolean, default: false},
    missed: {type: Boolean, default: false},
    price: {type: Number, min: 0, default: 0},
    payment: {type: mongoose.Schema.ObjectId, ref: 'Payment', default: null}
});

module.exports = mongoose.model('Appointment', appointmentSchema);
