var mongoose = require('mongoose');

var patientSchema = mongoose.Schema
({
    name: {type: String, required: true},
    email: {type: String, required: true},
    primary_phone: {type: String, required: true},
    appointment_price: {type: Number, min: 0, default: 330}
});

module.exports = mongoose.model('Patient', patientSchema);
