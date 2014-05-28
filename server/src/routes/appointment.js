var routeCommon = require('./common/common');
var Appointment = require('../models/appointment');

module.exports.addRoutes = function(app, security)
{
    // get all appointments
    app.get('/api/appointments', routeCommon.isLoggedIn, function(request, response) 
    {
        var populateField = null;

        if (request.query.hasOwnProperty('populate_patient'))
            populateField = 'patient';

        // check if we need to do a subse
        routeCommon.handleGetAll(Appointment, populateField, request, response);
    });

    // get a single appointment
    app.get('/api/appointments/:id', routeCommon.isLoggedIn, function(request, response) 
    {
        routeCommon.handleGetOne(Appointment, request, response);
    });

    // create appointment
    app.post('/api/appointments', routeCommon.isLoggedIn, function(request, response) 
    {
        routeCommon.handleCreate(Appointment, request, response);
    });

    // update a single appointment
    app.put('/api/appointments/:id', routeCommon.isLoggedIn, function(request, response) 
    {
        routeCommon.handleUpdate(Appointment, request, response);
    });

    // delete a appointment
    app.delete('/api/appointments/:id', routeCommon.isLoggedIn, function(request, response)
    {
        routeCommon.handleDelete(Appointment, request, response);
    });
};