var request = require('supertest');
var expect = require('chai').expect;
var async = require('async');
var common = require('./common');
var app = require('../src/server');
var Patient = require('../src/models/patient');
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
                    email: "1@here.com",
                    appointments:
                    [
                        {
                            when: (new Date()).toISOString(),
                            summary: "The guy is a cunt.",
                            summarySent: false,
                            missed: false
                        },
                        {
                            when: (new Date()).toISOString(),
                            summary: "More",
                            summarySent: false
                        }
                    ],
                    payments:
                    [
                        {
                            when: (new Date()).toISOString(),
                            sum: 1000
                        },
                        {
                            when: (new Date()).toISOString(),
                            sum: 1500,
                            invoice: 'http://www.google.com'
                        }
                    ]
                },

                {
                    name: "2_name",
                    primaryPhone: "+972546653002",
                    email: "2@here.com",
                    appointmentPrice: 500,
                    appointments:
                        [
                            {
                                when: (new Date(2010, 1, 1)).toISOString(),
                                price: 500
                            },

                            {
                                when: (new Date(2011, 1, 1)).toISOString(),
                                price: 250
                            },

                            {
                                when: (new Date(2012, 1, 1)).toISOString(),
                                price: 275
                            },
                        ]
                }
            ];

        // inject test fixtures
        common.injectFixtures(patientFixtures, done);
    });

    describe('GET /api/patients/x/payments', function()
    {
        it('should return all payments for patient x', function(done)
        {
            request(app)
                .get('/api/patients/' + patientFixtures[0]._id + '/payments')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, response)
                {
                    if (err) return done(err);
                    common.compareFixturesToResponse(patientFixtures[0].payments, response.body, null);
                    done();
                });
        });
    });

    describe('POST /api/patients/x/payments', function()
    {
        describe('when creating a new payment for a patient that wholly covers appointments', function()
        {
            it('should respond with 201, patient info and create an object', function(done)
            {
                var newPayment =
                {
                    when: (new Date()).toISOString(),
                    sum: 750
                };

                patient = patientFixtures[1];

                request(app)
                    .post('/api/patients/' + patient._id + '/payments')
                    .send(newPayment)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, response)
                    {
                        if (err) return done(err, null);

                        // expect the debt to equal the cost of the third appointment
                        patient.debt =
                        {
                            total: patient.appointments[2].price,
                            oldestNonPaidAppointment: patient.appointments[2].when
                        }

                        // expect patient + first two appointments (to which it attached to)
                        patient.payments = [newPayment];
                        patient.appointments = [patient.appointments[0], patient.appointments[1]];

                        // did we get it as a response?
                        common.compareFixtureToResponse(patient, response.body, null);

                        done();
                    });
            });
        });

        describe('when creating a new payment for a patient that doesnt wholly cover appointments', function()
        {
            it('should respond with 403', function(done)
            {
                var newPayment =
                {
                    when: (new Date()).toISOString(),
                    sum: 745
                };

                patient = patientFixtures[1];

                request(app)
                    .post('/api/patients/' + patient._id + '/payments')
                    .send(newPayment)
                    .expect('Content-Type', /json/)
                    .expect(403)
                    .end(done);
            });
        });

        describe('when creating a new payment for a patient that with a sum too large', function()
        {
            it('should respond with 403', function(done)
            {
                var newPayment =
                {
                    when: (new Date()).toISOString(),
                    sum: 5000
                };

                patient = patientFixtures[1];

                request(app)
                    .post('/api/patients/' + patient._id + '/payments')
                    .send(newPayment)
                    .expect('Content-Type', /json/)
                    .expect(403)
                    .end(done);
            });
        });
    });

    describe('PUT /api/patients/x/payments', function()
    {
        describe('when updating an payment for a patient', function()
        {
            it('should respond with 200, patient info and updated object', function(done)
            {
                patientFixtures[0].payments[0].when = (new Date()).toISOString();

                request(app)
                    .put('/api/patients/' + patientFixtures[0]._id + '/payments/' + patientFixtures[0].payments[0]._id)
                    .send(patientFixtures[0].payments[0])
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, response)
                    {
                        if (err) return done(err, null);

                        // expect only 1 payment
                        patientFixtures[0].payments = [patientFixtures[0].payments[0]];

                        // did we get it as a response?
                        common.compareFixtureToResponse(patientFixtures[0], response.body, null);

                        done();
                    });
            });
        });
    });

    describe('DELETE /api/patients/x/payments', function()
    {
        describe('when deleting an payment for a patient', function()
        {
            it('should respond with 200, patient info', function(done)
            {
                request(app)
                    .delete('/api/patients/' + patientFixtures[0]._id + '/payments/' + patientFixtures[0].payments[0]._id)
                    .send()
                    .expect(200)
                    .end(function(err, response)
                    {
                        if (err) return done(err, null);

                        // did we get it as a response?
                        delete patientFixtures[0].payments;
                        common.compareFixtureToResponse(patientFixtures[0], response.body, null);

                        done();
                    });
            });
        });
    });
});