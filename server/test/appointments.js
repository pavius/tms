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
                appointmentPrice: 500
            },
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
});