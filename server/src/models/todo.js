var mongoose = require('mongoose');

var todoSchema = mongoose.Schema
({
    created: {type: Date, default: Date.now()},
    type: {type: String, enum: ['urgent', 'later'], default: 'urgent'},
    text: {type: String},
    due: {type: Date},
    complete: {type: Boolean, default: false}
});

module.exports = mongoose.model('Todo', todoSchema);
