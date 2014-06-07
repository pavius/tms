var routeCommon = require('./common/common');
var Patient = require('../models/patient');
var Appointment = require('../models/appointment');

module.exports.addRoutes = function(app, security)
{
    // get all appointments
    app.get('/api/patients/:patientId/appointments', routeCommon.isLoggedIn, function(request, response) 
    {
        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                response.send(200, patientFromDb.appointments);
            }
        });
    });

    // get a single appointment
    app.get('/api/patients/:patientId/appointments/:id', routeCommon.isLoggedIn, function(request, response) 
    {
        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                // find the appropriate appointment
                appointment = patientFromDb.appointments.id(request.params.id);

                // found?
                if (appointment !== null)   response.send(200, appointment);
                else                        response.send(404);
            }
        });
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