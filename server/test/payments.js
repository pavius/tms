var request = require('supertest');
var expect = require('chai').expect;
var async = require('async');
var app = require('../src/server');
var common = require('./common');

var Patient = require('../src/models/patient');
var Appointment = require('../src/models/appointment');
var Payment = require('../src/models/payment');

describe('Payments', function() 
{
    var patientFixtures = [];
    var fixtures = [];

    beforeEach(function(done)
    {
        patientFixtures =
        [
            {
                name: "1_name",
                primaryPhone: "+972546653001",
                email: "1@here.com"
            },

            {
                name: "2_name",
                primaryPhone: "+972546653002",
                email: "2@here.com",
            },
        ];

        appointmentFixtures = 
        [
            {
                patient: patientFixtures[0],
                when: (new Date(2014, 1, 1)).toISOString(),
            },
            {
                patient: patientFixtures[0],
                when: (new Date(2014, 1, 2)).toISOString(),
                price: 600
            },
            {
                patient: patientFixtures[0],
                when: (new Date(2014, 1, 3)).toISOString(),
                price: 200
            },
            {
                patient: patientFixtures[0],
                when: (new Date(2015, 1, 3)).toISOString()
            }
        ];

        // update fixtures because we're modifying them with ids
        fixtures = 
        [
            {
                patient: patientFixtures[0],
                when: (new Date()).toISOString(),
                sum: 1000,
            },

            {
                patient: patientFixtures[1],
                when: (new Date()).toISOString(),
                sum: 1500,
                invoice: 'http://www.google.com'
            },
        ];

        async.series
        ([
            function(callback)
            {
                // insert patients
                common.dropCollectionAndInsertFixtures(Patient, 'patients', patientFixtures, callback);
            },

            function(callback)
            {
                // update patient references in payments
                common.attachReferences(fixtures, ['patient']);

                // shove payments
                common.dropCollectionAndInsertFixtures(Payment, 'payments', fixtures, callback);
            },

            function(callback)
            {
                // update patient, payment references in appointments
                common.attachReferences(appointmentFixtures, ['patient', 'payment']);

                // shove appointments
                common.dropCollectionAndInsertFixtures(Appointment, 'appointments', appointmentFixtures, done);
            }
        ]);
    });

    describe('GET /api/payments', function() 
    {
        it('should return all payments', function(done)
        {
            common.getAllAndCompareToFixtures('payments', Payment, fixtures, null, done);
        });
    });

    describe('GET /api/payments/<id>', function()
    {
        describe('when requesting a payment with a valid id', function() 
        {
            it('should return a single payment', function(done)
            {
                common.getOneAndCompareToFixture('payments', Payment, fixtures[0], null, done);
            });
        });

        describe('when requesting a payment with an invalid id', function() 
        {
            it('should return 404', function(done)
            {
                common.getInvalidOneAndVerifyNotFound('payments', Payment, done);
            });
        });
    });

    describe('POST /api/payments', function() 
    {
        function createPaymentVerifyAttachment(patientId, sum, appointmentCount, done)
        {
            var newPayment = 
            {
                patient: patientId,
                when: (new Date()).toISOString(),
                sum: sum,
                invoice: 'http://www.greeninvoice.co.il'
            };

            common.postNewAndVerifyCreation('payments', Payment, newPayment, null, function(err, response)
            {
                if (err) done(err);
                else
                {
                    Appointment.find({payment: response._id}, function(err, appointments)
                    {
                        if (err) done(err);
                        else
                        {
                            expect(appointments).to.have.length(appointmentCount);

                            appointments.forEach(function(appointment)
                            {
                                expect(response.appointments).to.contain(String(appointment._id));
                            });

                            done();
                        }
                    });
                }
            });
        }

        function createPaymentVerifyFailure(patientId, sum, done)
        {
            var newPayment = 
            {
                patient: patientId,
                when: (new Date()).toISOString(),
                sum: sum,
                invoice: 'http://www.greeninvoice.co.il'
            };

            request(app)
            .post('/api/payments')
            .send(newPayment)
            .expect(403)
            .end(function(err, response) 
            {
                done(err);
            });
        }

        describe('when creating a payment that covers all appointments', function() 
        {
            it('should respond with 201, create an object and attach to appointments', function(done) 
            {
                createPaymentVerifyAttachment(patientFixtures[0]._id, 1130, 3, done);
            });
        });

        describe('when creating a payment that covers some appointments', function() 
        {
            it('should respond with 201, create an object and attach to appointments', function(done) 
            {
                createPaymentVerifyAttachment(patientFixtures[0]._id, 930, 2, done);
            });
        });

        describe('when creating a payment that covers all appointments, except one is in the future', function() 
        {
            it('should respond with 403', function(done) 
            {
                createPaymentVerifyFailure(patientFixtures[0]._id, 1460, done);
            });
        });

        describe('when creating a payment with a larger sum than appointments', function() 
        {
            it('should respond with 403', function(done) 
            {
                createPaymentVerifyFailure(patientFixtures[0]._id, 5000, done);
            });
        });

        describe('when creating a payment with which partially matches an appointment', function() 
        {
            it('should respond with 403', function(done) 
            {
                createPaymentVerifyFailure(patientFixtures[0]._id, 700, done);
            });
        });
    });

    describe('PUT /api/payments', function() 
    {
        describe('when updating a resource /payments', function() 
        {
            it('should respond with 204 and update the object', function(done) 
            {
                var updatedPayment = 
                {
                    when: (new Date()).toISOString(),
                    sum: 400,
                    invoice: 'http://www.greeninvoice.co.il/whut'
                };

                common.updateAndVerifyUpdate('payments', Payment, fixtures[0], updatedPayment, null, done);
            });
        });
    });

    describe('DELETE /api/payments/:id', function() 
    {
        describe('when deleting an existing payment', function() 
        {
            it('should respond with 204', function(done) 
            {
                common.deleteExistingAndVerifyDeleted('payments', Payment, fixtures, done);
            });
        });

        describe('when deleting an inexistent payment', function() 
        {
            it('should respond with 404', function(done)
            {
                common.deleteNoneExistingAndVerifyResponse('payments', Payment, done);
            });
        });
    });
});