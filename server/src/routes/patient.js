var _ = require('underscore');
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
        var extendedQueries = {
            'appointmentsBetween':
            function(args)
            {
                return { appointments: { $elemMatch: { when: { $gte: args[0], $lte: args[1] } } } }
            }
        }

        routeCommon.handleGetAll(Patient, request, response, extendedQueries);
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
        // remove 'id' from request body, if it exists
        delete request.body._id;

        // check if the request is telling us to re-calculate the status
        if (request.body.manualStatus != 'recalculate')
        {
            Patient.findByIdAndUpdate(request.params.id, request.body, function(dbError, dbObject)
            {
                if (dbError)                response.json(403, dbError);
                else                        response.json(200, dbObject);
            });
        }
        else
        {
            Patient.findById(request.params.id, function(dbError, dbObject)
            {
                // set status to new, so as to "reset" the status logic
                dbObject.status = 'new';
                dbObject.status = dbObject.calculateStatus();

                dbObject.save(function(dbError, dbObject)
                {
                    if (dbError)                response.json(403, dbError);
                    else                        response.json(200, dbObject);
                });
            });
        }
    });

    // delete a patient
    app.delete('/api/patients/:id', routeCommon.isLoggedInSendError, function(request, response)
    {
        routeCommon.handleDelete(Patient, request, response);
    });
};