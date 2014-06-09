var mongoose = require('mongoose');

var appointmentSchema = mongoose.Schema
({
    when: Date,
    summary: String,
    summarySent: {type: Boolean, default: false},
    missed: {type: Boolean, default: false},
    price: {type: Number, min: 0, default: 0},
    payment: {type: mongoose.Schema.ObjectId, ref: 'Payment'}
});

// before we save, populate stuff
appointmentSchema.pre('save', function (next)
{
    // have we received no price? if so, use our parent's (i.e. patient) price
    if (this.price === 0)
        this.price = this.parent().appointmentPrice;

    next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);
