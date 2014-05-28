var async = require('async');

var routeCommon = require('./common/common');
var Payment = require('../models/payment');
var Appointment = require('../models/appointment');

module.exports.addRoutes = function(app, security)
{
    // get all payments
    app.get('/api/payments', routeCommon.isLoggedIn, function(request, response) 
    {
        routeCommon.handleGetAll(Payment, null, request, response);
    });

    // get a single payment
    app.get('/api/payments/:id', routeCommon.isLoggedIn, function(request, response) 
    {
        routeCommon.handleGetOne(Payment, request, response);
    });

    // create payment
    app.post('/api/payments', routeCommon.isLoggedIn, function(request, response) 
    {
        // get the oldest unpaid appointments
        Appointment.find({patient: request.body.patient, payment: null, when: {$lte: Date.now()}}).sort('when').exec(function(dbError, dbResponse)
        {
            if (dbError) response.json(403, dbError);
            else
            {
                var idx, sumLeft;
                var appointmentsToAttachTo = [];

                // sum up the appointments until we deplete the payment. it must fit
                for (idx = 0, sumLeft = request.body.sum; 
                     (sumLeft > 0) && (idx < dbResponse.length);
                     ++idx)
                {
                    // does the payment cover this appointment?
                    if (dbResponse[idx].price <= sumLeft)
                    {
                        sumLeft -= dbResponse[idx].price;
                        appointmentsToAttachTo.push(dbResponse[idx]);
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
                    if (idx === dbResponse.length)  response.json(403, {'error': 'Sum is too large'});
                    else                            response.json(403, {'error': 'Sum only covers an appointment partially'});
                }
                else
                {
                    routeCommon.handleCreateDontRespondOnSuccess(Payment, request, response, function(paymentFromDb)
                    {
                        if (paymentFromDb !== null)
                        {
                            async.forEach(appointmentsToAttachTo, 
                                           
                                            // apply updated appointment 
                                            function(appointment, callback)
                                            {
                                                appointment.payment = paymentFromDb._id;
                                                appointment.save(callback);
                                            },

                                            // done, respond
                                            function(err)
                                            {
                                                if (err) response.json(403, err);
                                                else     
                                                {
                                                    paymentFromDb = paymentFromDb.toObject();
                                                    paymentFromDb.appointments = [];

                                                    // shove attached appointments ids into the payment
                                                    for (var idx = 0; idx < appointmentsToAttachTo.length; ++idx)
                                                        paymentFromDb.appointments.push(appointmentsToAttachTo[idx]._id);

                                                    response.json(201, paymentFromDb);
                                                }
                                            });
                        }
                    });
                }
            }
        });
    });

    // update a single payment
    app.put('/api/payments/:id', routeCommon.isLoggedIn, function(request, response) 
    {
        routeCommon.handleUpdate(Payment, request, response);
    });

    // delete a payment
    app.delete('/api/payments/:id', routeCommon.isLoggedIn, function(request, response)
    {
        routeCommon.handleDelete(Payment, request, response);
    });
};