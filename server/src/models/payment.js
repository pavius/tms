var mongoose = require('mongoose');

var paymentSchema = mongoose.Schema
({
    patient: {type: mongoose.Schema.ObjectId, ref: 'Patient', required: true},
    when: {type: Date, default: Date.now()},
    sum: {type: Number, min: 1, required: true},
    invoice: String
});

module.exports = mongoose.model('Payment', paymentSchema);
