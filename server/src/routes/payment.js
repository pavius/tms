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

            var appointmentsToAttachTo = [];

            // sum up the appointments until we deplete the payment. it must fit
            for (var idx = 0, sumLeft = request.body.sum;
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

        function formatDateForGreenInvoice(date)
        {
            if (!(date instanceof Date))
                date = new Date(date);

            var yyyy = date.getFullYear().toString();
            var mm = (date.getMonth() + 1).toString();
            var dd  = date.getDate().toString();

            return yyyy + '-' + (mm[1] ? mm : "0" + mm[0]) + '-' + (dd[1] ? dd : "0" + dd[0]);
        }

        function issueInvoice(patient, payment, callback)
        {
            var privateKey = process.env.GREENINVOICE_PRIVATE_KEY || '';
            var publicKey = process.env.GREENINVOICE_PUBLIC_KEY || '';
            var signer = crypto.createHmac('sha256', new Buffer(privateKey, 'utf8'));

            // shove invoice part, if doesn't exist (easier later on)
            if (!payment.transaction.hasOwnProperty('invoice'))
                payment.transaction.invoice = {};

            // check if we even need to issue the invoice
            if (payment.transaction.invoice.hasOwnProperty('issue') &&
                !payment.transaction.invoice.issue)
                return callback();

            var params =
            {
                timestamp: new Date().getTime(),
                callback_url: (process.env.ROOT_URL || 'https://pavius.localtunnel.me') + '/api/patients/' + patient._id + '/payments/' + payment._id + '/invoices',
                doc_type: 320,
                client:
                {
                    send_email: payment.emailInvoice,
                    name: payment.transaction.invoice.recipient || patient.name,
                    email: patient.email
                },
                income:
                [
                    {
                        price: payment.sum,
                        description: payment.transaction.invoice.item || 'אימון'
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
                                        date: formatDateForGreenInvoice(payment.transaction.cheque.date)
                                      });
            }
            else if (payment.transaction.type == 'transfer')
            {
                params.payment.push({
                    type: 4,
                    amount: payment.sum,
                    bank: payment.transaction.transfer.bank.name,
                    branch: payment.transaction.transfer.bank.branch,
                    account: payment.transaction.transfer.bank.account,
                    date: formatDateForGreenInvoice(payment.transaction.transfer.date)
                });
            }
            else
            {
                params.payment.push({
                                        type: 1,
                                        amount: payment.sum
                                    });
            }

            console.log("Issuing invoice:\n" + JSON.stringify(params, null, '\t'));

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
                        console.log("Got issue invoice response with error:\n" + JSON.stringify(body, null, '\t'));
                        error = error || body.error_description;
                        callback(new Error('Failed to issue invoice: ' + error));
                    }
                    else
                    {
                        console.log("Got issue invoice response:\n" + JSON.stringify(body, null, '\t'));
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
                var appointmentsToAttachTo = getPaymentAppointments(patientFromDb);

                if (appointmentsToAttachTo instanceof Error)
                {
                    response.json(403, {'error': appointmentsToAttachTo});
                }
                else
                {
                    var payment = patientFromDb.payments.create(request.body);

                    // save candidate ID in the body. we use the request body because it may contain fields not in
                    // the model (like "send email")
                    request.body._id = payment._id;

                    /* TODO: use redis to store the payment temporarily and have the webhook verify the ticket id
                     * stored in redis and then continue with what's going on here. the issue is that the webhook
                     * may be called before the patient is saved, theoretically */

                    // create invoice @ greeninvoice
                    issueInvoice(patientFromDb, request.body, function(invoice)
                    {
                        if (invoice instanceof Error)
                        {
                            response.json(403, {'error': invoice});
                        }
                        else
                        {
                            // if an invoice was issued, save ticket id so that when the callback is handled, we'll know
                            // to which payment it's for
                            if (invoice)
                                payment.invoice.ticket = invoice.ticket_id;

                            // shove the new payment
                            patientFromDb.payments.push(payment);

                            // save bank details for patient if payment is cheque. this is used so that
                            // the user doesn't need to re-type bank details each type (but will be able to override them)
                            if (request.body.transaction.type == 'cheque') patientFromDb.bank = request.body.transaction.cheque.bank;
                            else if (request.body.transaction.type == 'transfer') patientFromDb.bank = request.body.transaction.transfer.bank;

                            // save the invoice recipient for this patient
                            patientFromDb.invoice.recipient = request.body.transaction.invoice.recipient;
                            patientFromDb.invoice.item = request.body.transaction.invoice.item;

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
        console.log("Got issue invoice webhook:\n" + JSON.stringify(request.body, null, '\t'));

        Patient.findOne({_id: request.params.patientId}, function(dbError, patientFromDb)
        {
            if (dbError)                   response.json(403, dbError);
            else if (!patientFromDb)       response.send(404);
            else
            {
                var payment = patientFromDb.payments.id(request.params.id);

                // does such an payment exist and does the ticket id match?
                if (payment !== null)
                {
                    if (payment.invoice.ticket == request.body.ticket_id)
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
                        console.warn("Unexpected ticket ID. Expected " + payment.invoice.ticket + " got " + request.body.ticket_id);
                        response.send(200);
                    }
                }
                else
                {
                    console.warn("Couldn't find payment with ID " + request.params.id);
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