var request = require('supertest');
var expect = require('chai').expect;
var async = require('async');
var common = require('./common');
var app = require('../src/server');
var Patient = require('../src/models/patient');
var Appointment = require('../src/models/appointment');

describe('Appointments', function() 
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
                    },

                    {
                        when: (new Date()).toISOString(),
                        summary: "More 2",
                        summarySent: false
                    },

                    {
                        when: (new Date()).toISOString(),
                        summary: "No hope for this one.",
                        summarySent: true,
                        missed: false,
                        price: 600
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
                        when: (new Date()).toISOString(),
                        summary: "The guy is a cunt.",
                        summarySent: false,
                        missed: false
                    }
                ]
            }
        ];

        // inject test fixtures
        common.injectFixtures(patientFixtures, done);
    });

    describe('GET /api/patients/x/appointments', function() 
    {
        it('should return all appointments for patient x', function(done)
        {
            request(app)
            .get('/api/patients/' + patientFixtures[0]._id + '/appointments')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, response)
            {
                if (err) return done(err);
                common.compareFixturesToResponse(patientFixtures[0].appointments, response.body, null);
                done();
            });
        });
    });

    describe('POST /api/patients/x/appointments', function() 
    {
        describe('when creating a new appointment for a patient', function() 
        {
            it('should respond with 201, patient info and create an object', function(done) 
            {
                var newAppointment = 
                {
                    when: (new Date()).toISOString(),
                    summary: 'Why did I choose this profession?',
                    summarySent: false,
                    missed: false,
                    price: 605
                };

                request(app)
                .post('/api/patients/' + patientFixtures[1]._id + '/appointments')
                .send(newAppointment)
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, response) 
                {
                    if (err) return done(err, null);

                    // expect patient + appointment
                    patientFixtures[1].appointments = [newAppointment];

                    // did we get it as a response?
                    common.compareFixtureToResponse(patientFixtures[1], response.body, null);

                    done();
                });
            });
        });
    });

    describe('PUT /api/patients/x/appointments', function()
    {
        describe('when updating an appointment for a patient', function()
        {
            it('should respond with 200, patient info and updated object', function(done)
            {
                patientFixtures[1].appointments[0].price = 222;

                request(app)
                    .put('/api/patients/' + patientFixtures[1]._id + '/appointments/' + patientFixtures[1].appointments[0]._id)
                    .send(patientFixtures[1].appointments[0])
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, response)
                    {
                        if (err) return done(err, null);

                        // did we get it as a response?
                        common.compareFixtureToResponse(patientFixtures[1], response.body, null);

                        done();
                    });
            });
        });
    });

    describe('DELETE /api/patients/x/appointments', function()
    {
        describe('when deleting an appointment for a patient', function()
        {
            it('should respond with 200, patient info', function(done)
            {
                request(app)
                    .delete('/api/patients/' + patientFixtures[1]._id + '/appointments/' + patientFixtures[1].appointments[0]._id)
                    .send()
                    .expect(200)
                    .end(function(err, response)
                    {
                        if (err) return done(err, null);

                        // did we get it as a response?
                        delete patientFixtures[1].appointments;
                        common.compareFixtureToResponse(patientFixtures[1], response.body, null);

                        done();
                    });
            });
        });
    });
});
