var _ = require('underscore');
var async = require('async');

var routeCommon = require('./common/common');
var Patient = require('../models/patient');
var Payment = require('../models/payment');

module.exports.addRoutes = function(app, security)
{
    // get all payments
    app.get('/api/patients/:patientId/payments', routeCommon.isLoggedIn, function(request, response)
    {
        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                response.send(200, patientFromDb.payments);
            }
        });
    });

    // get a single payment
    app.get('/api/patients/:patientId/payments/:id', routeCommon.isLoggedIn, function(request, response)
    {
        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                // find the appropriate payment
                payment = patientFromDb.payments.id(request.params.id);

                // found?
                if (payment !== null)   response.send(200, payment);
                else                    response.send(404);
            }
        });
    });

    // create payment
    app.post('/api/patients/:patientId/payments', routeCommon.isLoggedIn, function(request, response)
    {
        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                var payment = patientFromDb.payments.create(request.body);

                // shove the new payment
                patientFromDb.payments.push(payment);

                // get all unpaid appointments
                unpaidAppointments = _.filter(patientFromDb.appointments, function(appointment)
                {
                    return !appointment.hasOwnProperty('payment');
                });

                // sort the unpaid appointments by date
                unpaidAppointments = _.sortBy(unpaidAppointments, function(appointment)
                {
                    return appointment.when;
                });

                appointmentsToAttachTo = [];

                // sum up the appointments until we deplete the payment. it must fit
                for (idx = 0, sumLeft = request.body.sum;
                     (sumLeft > 0) && (idx < unpaidAppointments.length);
                     ++idx)
                {
                    // does the payment cover this appointment?
                    if (unpaidAppointments[idx].price <= sumLeft)
                    {
                        sumLeft -= unpaidAppointments[idx].price;
                        appointmentsToAttachTo.push(unpaidAppointments[idx]);
                    }
                    else
                        // not enough to cover this appointment. this is not allowed
                        // stop here and this will be detected and an error returned
                        break;
                }

                // sum must cover exactly an amount of appointments (either all or some)
                if (sumLeft !== 0)
                {
                    // if we stopped due to no more appointments, make sure the sum
                    // is at zero, otherwise the payment is too much
                    if (idx === appointmentsToAttachTo.length)  response.json(403, {'error': 'Sum is too large'});
                    else                                        response.json(403, {'error': 'Sum only covers an appointment partially'});
                }
                else
                {
                    // attach to the appointment
                    appointmentsToAttachTo.forEach(function(appointment)
                    {
                       appointment.payment = payment._id;
                    });
                }

                // update debt
                // patientFromDb.status = patientFromDb.calculateDebt();

                // save self
                patientFromDb.save(function(dbError, patientFromDb)
                {
                    if (dbError)    response.json(403, dbError);
                    else
                    {
                        // don't care about all payments, just return new one
                        patientFromDb.payments = [payment];
                        patientFromDb.appointments = appointmentsToAttachTo;

                        // return the patient
                        response.send(201, patientFromDb);
                    }
                });
            }
        });
    });

    // update a single payment
    app.put('/api/patients/:patientId/payments/:id', routeCommon.isLoggedIn, function(request, response)
    {
        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                var payment = patientFromDb.payments.id(request.params.id);

                // does such an payment exist?
                if (payment !== null)
                {
                    // update the payment
                    routeCommon.updateDocument(payment, Payment, request.body);

                    // update status
                    patientFromDb.status = patientFromDb.calculateStatus();

                    // save self
                    patientFromDb.save(function(dbError, patientFromDb)
                    {
                        if (dbError)    response.json(403, dbError);
                        else
                        {
                            // return the patient + the updated payment
                            patientFromDb.payments = [patientFromDb.payments.id(request.params.id)];

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

    // delete an payment
    app.delete('/api/patients/:patientId/payments/:id', routeCommon.isLoggedIn, function(request, response)
    {
        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                // update the payment
                patientFromDb.payments.id(request.params.id).remove();

                // update status
                patientFromDb.status = patientFromDb.calculateStatus();

                // save self
                patientFromDb.save(function(dbError, patientFromDb)
                {
                    if (dbError)    response.json(403, dbError);
                    else
                    {
                        // return the patient, with no payments
                        delete patientFromDb.appointments;
                        delete patientFromDb.payments;

                        response.send(200, patientFromDb);
                    }
                });
            }
        });
    });
};