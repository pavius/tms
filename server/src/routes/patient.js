var async = require('async');

var routeCommon = require('./common/common');
var Patient = require('../models/patient');
var Appointment = require('../models/appointment');
var Payment = require('../models/payment');

module.exports.addRoutes = function(app, security)
{
    // get all patients
    app.get('/api/patients', routeCommon.isLoggedInSendError, function(request, response)
    {
        routeCommon.handleGetAll(Patient, request, response);
    });

    // get a single patient
    app.get('/api/patients/:id', routeCommon.isLoggedInSendError, function(request, response)
    {
        routeCommon.handleGetOne(Patient, request, response);
    });

    // create patient
    app.post('/api/patients', routeCommon.isLoggedInSendError, function(request, response)
    {
        routeCommon.handleCreate(Patient, request, response);
    });

    // update a single patient
    app.put('/api/patients/:id', routeCommon.isLoggedInSendError, function(request, response)
    {
        routeCommon.handleUpdate(Patient, request, response);
    });

    // delete a patient
    app.delete('/api/patients/:id', routeCommon.isLoggedInSendError, function(request, response)
    {
        routeCommon.handleDelete(Patient, request, response);
    });
};