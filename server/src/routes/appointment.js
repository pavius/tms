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
    app.post('/api/patients/:patientId/appointments', routeCommon.isLoggedIn, function(request, response) 
    {
        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                var appointment = patientFromDb.appointments.create(request.body);

                // shove the new appointment
                patientFromDb.appointments.push(appointment);

                // save self
                patientFromDb.save(function(dbError, patientFromDb)
                {
                    if (dbError)    response.json(403, dbError);
                    else
                    {
                        // don't care about all appointments, just return new one
                        patientFromDb.appointments = [appointment];

                        // return the patient
                        response.send(201, patientFromDb);
                    }
                });
            }
        });
    });

    // update a single appointment
    app.put('/api/patients/:patientId/appointments/:id', routeCommon.isLoggedIn, function(request, response)
    {
        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                // update the appointment
                routeCommon.updateDocument(patientFromDb.appointments.id(request.params.id), Appointment, request.body);

                // save self
                patientFromDb.save(function(dbError, patientFromDb)
                {
                    if (dbError)    response.json(403, dbError);
                    else
                    {
                        // return the patient
                        response.send(200, patientFromDb);
                    }
                });
            }
        });
    });

    // delete a appointment
    app.delete('/api/appointments/:id', routeCommon.isLoggedIn, function(request, response)
    {
        routeCommon.handleDelete(Appointment, request, response);
    });
};