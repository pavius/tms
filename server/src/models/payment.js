var mongoose = require('mongoose');

var paymentSchema = mongoose.Schema
({
    when: {type: Date, default: Date.now()},
    sum: {type: Number, min: 1, required: true},
    invoice:
    {
        ticket: {type: String},
        id: {type: String},
        url: {type: String}
    },
    transaction:
    {
        type: {type: String, enum: ['cash', 'cheque'], default: 'cash'},
        cheque:
        {
            number: {type: String},
            date: {type: Date},
            bank:
            {
                name: {type: String},
                branch: {type: String},
                account: {type: String}
            }
        }
    }
});

module.exports = mongoose.model('Payment', paymentSchema);
