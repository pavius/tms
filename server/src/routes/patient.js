var async = require('async');

var routeCommon = require('./common/common');
var Patient = require('../models/patient');
var Appointment = require('../models/appointment');
var Payment = require('../models/payment');

module.exports.addRoutes = function(app, security)
{
    // get all patients
    app.get('/api/patients', routeCommon.isLoggedIn, function(request, response) 
    {
        routeCommon.handleGetAll(Patient, null, request, response);
    });

    // get a single patient
    app.get('/api/patients/:id', routeCommon.isLoggedIn, function(request, response) 
    {
        // use normal get one if no query params passed
        if (!request.query.hasOwnProperty('appointments') &&
            !request.query.hasOwnProperty('payments'))
        {
            routeCommon.handleGetOne(Patient, request, response);
        }
        else
        {
            // get the patient but don't respond if it was received successfully, rather augment
            // it with its appointments and/or patients
            routeCommon.handleGetOneDontRespondOnSuccess(Patient, request, response, function(patientFromDb)
            {
                if (patientFromDb !== null)
                {
                    var patient = patientFromDb.toObject();

                    async.parallel([

                        // get appointments for this patient
                        function(callback)
                        {
                            Appointment.find({patient: patientFromDb._id}).select('-__v -patient').exec(function(dbErr, dbObject)
                            {
                                patient.appointments = dbObject;
                                callback(null);
                            });
                        },

                        // get payments for this patient
                        function(callback)
                        {
                            Payment.find({patient: patientFromDb._id}).select('-__v -patient').exec(function(dbErr, dbObject)
                            {
                                patient.payments = dbObject;
                                callback(null);
                            });
                        },
                    ],
                    function(err)
                    {
                        response.json(patient);
                    });
                }
            });
        }
    });

    // create patient
    app.post('/api/patients', routeCommon.isLoggedIn, function(request, response) 
    {
        routeCommon.handleCreate(Patient, request, response);
    });

    // update a single patient
    app.put('/api/patients/:id', routeCommon.isLoggedIn, function(request, response) 
    {
        routeCommon.handleUpdate(Patient, request, response);
    });

    // delete a patient
    app.delete('/api/patients/:id', routeCommon.isLoggedIn, function(request, response)
    {
        routeCommon.handleDelete(Patient, request, response);
    });
};