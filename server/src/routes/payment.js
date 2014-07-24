var _ = require('underscore');
var async = require('async');
var httpRequest = require('request');
var crypto = require('crypto');

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

            // save bank details for patient if payment is cheque. this is used so that
            // the user doesn't need to re-type bank details each type (but will be able to override them)
            if (payment.transaction.type == 'cheque') patient.bank = payment.transaction.cheque.bank;
            else if (payment.transaction.type == 'transfer') patient.bank = payment.transaction.transfer.bank;

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

        function issueInvoice(patient, payment, callback)
        {
            var privateKey = 'befec8b16bc6e91479c97a19b38a6b0b';
            var publicKey = '1774b28d2a2d05a44996d7cf2ff45454';
            var signer = crypto.createHmac('sha256', new Buffer(privateKey, 'utf8'));

            // overall receipt object - my callback just prints the POST parameters to the Heroku log
            var params =
            {
                timestamp: new Date().getTime(),
                // callback_url: 'http://localhost/,
                // callback_url: 'http://requestb.in/1cncanu1',
                callback_url: 'https://pavius.localtunnel.me/api/patients/' + patient._id + '/payments/' + payment._id + '/invoices',
                doc_type: 320,
                client:
                {
                    send_email: false,
                    name: patient.name
                },
                income:
                [
                    {
                        price: payment.sum,
                        description: 'אימון'
                    }
                ],
                payment: []
            };

            // if this is a cheque, we need to shove details about it
            if (payment.transaction.type == 'cheque')
            {
                params.payment.push({
                                        type: 2,
                                        amount: payment.sum,
                                        bank: payment.transaction.cheque.bank.name,
                                        branch: payment.transaction.cheque.bank.branch,
                                        account: payment.transaction.cheque.bank.account,
                                        number: payment.transaction.cheque.number,
                                        date: payment.transaction.cheque.date.toISOString().slice(0, 10)
                                      });
            }
            if (payment.transaction.type == 'transfer')
            {
                params.payment.push({
                    type: 4,
                    amount: payment.sum,
                    bank: payment.transaction.transfer.bank.name,
                    branch: payment.transaction.transfer.bank.branch,
                    account: payment.transaction.transfer.bank.account,
                    date: payment.transaction.transfer.date.toISOString().slice(0, 10)
                });
            }
            else
            {
                params.payment.push({
                                        type: 1,
                                        amount: payment.sum
                                    });
            }

            console.log("Issuing invoice");
            console.log(params);

            // generate a signature for the 'data' object - the unescape(encodeURIComponent())
            // is needed to support non-Latin characters properly
            var jsonData = unescape(encodeURIComponent(JSON.stringify(params)));
            var messageSignature = signer.update(jsonData).digest('base64');

            // message object to POST
            var data =
            {
                'apiKey': publicKey,
                'params': params,
                'sig': messageSignature
            };

            httpRequest(
                {
                    'method': 'POST',
                    'url': 'https://api.greeninvoice.co.il/api/documents/add',
                    'headers': {'content-type': 'application/json', 'charset': 'utf-8'},
                    'form': {'data': JSON.stringify(data)}
                },
                function (error, response, body)
                {
                    body = JSON.parse(body);

                    if (error || body.error_code !== 0)
                    {
                        error = error || body.error_description;
                        callback(new Error('Failed to issue invoice: ' + error));
                    }
                    else
                    {
                        console.log(body);
                        callback(body.data);
                    }
                }
            );
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

                    // create invoice @ greeninvoice
                    issueInvoice(patientFromDb, payment, function(invoice)
                    {
                        if (invoice instanceof Error)
                        {
                            response.json(403, {'error': invoice});
                        }
                        else
                        {
                            // save ticket id so that when the callback is handled, we'll know to which payment
                            // it's for
                            payment.invoice.ticket = invoice.ticket;

                            // shove the new payment
                            patientFromDb.payments.push(payment);

                            // attach to appointments
                            attachPaymentToAppointments(payment, patientFromDb, appointmentsToAttachTo, function(error)
                            {
                                if (error)  response.json(403, {'error': error});
                                else        response.send(201, patientFromDb);
                            });

                        }
                    });
                }
            }
        });
    });

    // payment invoice webhook from greeninvoice
    app.post('/api/patients/:patientId/payments/:id/invoices', function(request, response)
    {
        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                var payment = patientFromDb.payments.id(request.params.id);

                // does such an payment exist and does the ticket id match?
                if (payment !== null && payment.invoice.ticket == request.body.ticket_id)
                {
                    // from a security POV, it would have been best to query GI here using this ticket ID but meh
                    payment.invoice.id = request.body.id;
                    payment.invoice.url = request.body.url;

                    // save self
                    patientFromDb.save(function(dbError, patientFromDb)
                    {
                        response.send(200);
                    });
                }
                else
                {
                    // OK (don't tell whoever it is something went wrong)
                    response.send(200);
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