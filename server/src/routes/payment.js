var _ = require('underscore');
var async = require('async');

var routeCommon = require('./common/common');
var Patient = require('../models/patient');
var Payment = require('../models/payment');

module.exports.addRoutes = function(app, security)
{
    // get all payments
    app.get('/api/patients/:patientId/payments', routeCommon.isLoggedInSendError, function(request, response)
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
    app.get('/api/patients/:patientId/payments/:id', routeCommon.isLoggedInSendError, function(request, response)
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
    app.post('/api/patients/:patientId/payments', routeCommon.isLoggedInSendError, function(request, response)
    {
        function getPaymentAppointments(patient)
        {
            // get all unpaid appointments
            unpaidAppointments = patient.getUnpaidAppointments();

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
                if (idx === appointmentsToAttachTo.length)  return new Error('Sum is too large');
                else                                        return new Error('Sum only covers an appointment partially');
            }
            else
            {
                return appointmentsToAttachTo;
            }
        }

        function attachPaymentToAppointments(payment, patient, appointmentsToAttachTo, callback)
        {
            // attach to the appointment
            appointmentsToAttachTo.forEach(function(appointment)
            {
                appointment.payment = payment._id;
            });

            // update debt
            patient.debt = patient.calculateDebt();

            // save self
            patient.save(function(dbError, patient)
            {
                if (dbError) callback(new Error(dbError))
                else
                {
                    // don't care about all payments, just return new one
                    patient.payments = [payment];
                    patient.appointments = appointmentsToAttachTo;

                    callback();
                }
            });
        }
        
        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                // check if this payment is valid for the patient, by getting which appointments this payment
                // will attach to
                appointmentsToAttachTo = getPaymentAppointments(patientFromDb);

                if (appointmentsToAttachTo instanceof Error)
                {
                    response.json(403, {'error': appointmentsToAttachTo});
                }
                else
                {
                    var payment = patientFromDb.payments.create(request.body);

                    // shove the new payment
                    patientFromDb.payments.push(payment);

                    // attach to appointments
                    attachPaymentToAppointments(payment, patientFromDb, appointmentsToAttachTo, function(error)
                    {
                        if (error)  response.json(403, {'error': error});
                        else        response.send(201, patientFromDb);
                    });
                }
            }
        });
    });

    // update a single payment
    app.put('/api/patients/:patientId/payments/:id', routeCommon.isLoggedInSendError, function(request, response)
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

                    // update debt
                    patientFromDb.debt = patientFromDb.calculateDebt();

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
    app.delete('/api/patients/:patientId/payments/:id', routeCommon.isLoggedInSendError, function(request, response)
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