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
                // this should have been somewhere in appointments itself, but mongoose doesn't allow
                // overriding creation properly. use patient's price if not set in appointment
                if (!request.body.hasOwnProperty('price'))
                    request.body.price = patientFromDb.appointmentPrice;

                var appointment = patientFromDb.appointments.create(request.body);

                // shove the new appointment
                patientFromDb.appointments.push(appointment);

                // update status/debt
                patientFromDb.status = patientFromDb.calculateStatus();
                patientFromDb.debt = patientFromDb.calculateDebt();

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
                var appointment = patientFromDb.appointments.id(request.params.id);

                // does such an appointment exist?
                if (appointment !== null)
                {
                    // update the appointment
                    routeCommon.updateDocument(appointment, Appointment, request.body);

                    // update status/debt
                    patientFromDb.status = patientFromDb.calculateStatus();
                    patientFromDb.debt = patientFromDb.calculateDebt();

                    // save self
                    patientFromDb.save(function(dbError, patientFromDb)
                    {
                        if (dbError)    response.json(403, dbError);
                        else
                        {
                            // return the patient + the updated appointment
                            patientFromDb.appointments = [patientFromDb.appointments.id(request.params.id)];

                            // return the patient
                            response.send(200, patientFromDb);
                        }
                    });
                }
                else
                {
                    response.send(404);
                }
            }
        });
    });

    // delete an appointment
    app.delete('/api/patients/:patientId/appointments/:id', routeCommon.isLoggedIn, function(request, response)
    {
        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                // update the appointment
                patientFromDb.appointments.id(request.params.id).remove();

                // update status/debt
                patientFromDb.status = patientFromDb.calculateStatus();
                patientFromDb.debt = patientFromDb.calculateDebt();

                // save self
                patientFromDb.save(function(dbError, patientFromDb)
                {
                    if (dbError)    response.json(403, dbError);
                    else
                    {
                        // return the patient, with no appointments
                        delete patientFromDb.appointments;
                        delete patientFromDb.payments;

                        response.send(200, patientFromDb);
                    }
                });
            }
        });
    });
};