// This is test/app.js
var request = require('supertest');
var expect = require('chai').expect;
var mongoose = require('mongoose');
var async = require('async');
var app = require('../src/server');

var Patient = require('../src/models/patient');
var Appointment = require('../src/models/appointment');
var Payment = require('../src/models/payment');

/*
 * Helpers
 */

// replace the reference to an object with its mongo id
function attachReferences(objects, references)
{
    objects.forEach(function(object)
    {
        references.forEach(function(reference)
        {
            if (object.hasOwnProperty(reference))
                object[reference] = object[reference]._id;
        });
    });
}

// find an object within an array by a key and value
function findObjectInArrayByKey(array, key, value)
{
    for (var idx = 0; idx < array.length; ++idx)
    {
        if (String(array[idx][key]) === String(value))
            return array[idx];
    }

    return null;
}

// compare a fixture object to a response object
function compareFixtureToResponse(fixture, responseObject)
{
    // get keys of fixture
    var keys = Object.keys(fixture);
 
    // compare the two
    keys.forEach(function(key)
    {
        expect(responseObject[key]).to.equal(fixture[key]);
    });
}

// compare all fixtures to a response received from teh server
function compareFixturesToResponse(fixtures, response)
{
    fixtures.forEach(function(fixture)
    {
        // look for this object by id in the response
        responseObject = findObjectInArrayByKey(response, '_id', fixture._id);

        // must exist
        expect(responseObject).to.not.equal(null);

        // compare the fixture
        compareFixtureToResponse(fixture, responseObject);
    });
}

// empty collection and insert fixtures
function dropCollectionAndInsertFixtures(modelClass, collectionName, fixtures, done)
{
    mongoose.connection.collections[collectionName].drop(function(err) 
    {
        var objectsLeft = fixtures.length;
 
        fixtures.forEach(function(fixture)
        {
            modelClass.create(fixture, function(err, dbResponse)
            {
                if (err) return done(err);

                // shove the id into the fixture
                fixture._id = String(dbResponse._id);

                // once all patients are created, we're done
                if (--objectsLeft === 0 && done !== null) done();
            });
        });
    });
}

// get and compare to fixtures
function getAllAndCompareToFixtures(endpointName, modelClass, fixtures, done)
{
    request(app)
    .get('/api/' + endpointName)
    .expect('Content-Type', /json/)
    .expect(200)
    .end(function(err, response)
    {
        if (err) return done(err);

        compareFixturesToResponse(fixtures, response.body);
        done();
    });
}

// deep compare with support for defaults and ObjectId
function deepCompareFixtureAndResponse(fixture, response)
{
    // make sure all fixture members are in the response. the response
    // may contain fields which were injected as defaults. also, if fixture
    // has an ObjectID, compare it as a string
    Object.keys(fixture).forEach(function(key)
    {
        // stringify both to prevent cases like object id where the value is a number, 
        // but we expect a string
        expect(String(fixture[key])).to.equal(String(response[key]));
    });

}

// get one and compare to fixture
function getOneAndCompareToFixture(endpointName, modelClass, fixture, done)
{
    request(app)
    .get('/api/' + endpointName + '/' + fixture._id)
    .expect('Content-Type', /json/)
    .expect(200)
    .end(function(err, response)
    {
        if (err) return done(err);

        deepCompareFixtureAndResponse(fixture, response.body);
        done();
    });
}

// get invalid one and compare to fixture
function getInvalidOneAndVerifyNotFound(endpointName, modelClass, done)
{
    request(app)
    .get('/api/' + endpointName + '/000000000000000000000000')
    .expect('Content-Type', /text/)
    .expect(404)
    .end(done);
}

// create an object and verify creation
function postNewAndVerifyCreation(endpointName, modelClass, modelData, callback)
{
    request(app)
    .post('/api/' + endpointName)
    .send(modelData)
    .expect('Content-Type', /json/)
    .expect(201)
    .end(function(err, response) 
    {
        if (err) return callback(err, null);

        modelClass.findOne({_id: response.body._id}, function(err, dbResponse)
        {
            if (err) return callback(err, null);

            keys = Object.keys(modelData);

            // verify all fields passed in fixtures are returned as is and exist in the db
            for (var idx = 0; idx < keys.length; ++idx)
            {
                expect(response.body[keys[idx]]).to.equal(modelData[keys[idx]]);

                // do a little conversions on certain types, or just get the value as is (stringified)
                if (dbResponse[keys[idx]] instanceof Date)
                    dbResponseValue = dbResponse[keys[idx]].toISOString();
                else
                    dbResponseValue = String(dbResponse[keys[idx]]);

                expect(String(modelData[keys[idx]])).to.equal(dbResponseValue);
            }

            callback(null, response.body);
        });
    });
}

// update a resource by id, check in the db that it was updated
function updateAndVerifyUpdate(endpointName, modelClass, modelData, update, done)
{
    request(app)
    .put('/api/' + endpointName + '/' + modelData._id)
    .send(update)
    .expect(200)
    .end(function(err, response) 
    {
        if (err) return done(err);

        modelClass.findOne({_id: modelData._id}, function(err, dbResponse)
        {
            if (err) return done(err);

            keys = Object.keys(update);

            // verify all fields passed in fixtures are returned as is and exist in the db
            for (var idx = 0; idx < keys.length; ++idx)
            {
                // do a little conversions on certain types, or just get the value as is (stringified)
                if (dbResponse[keys[idx]] instanceof Date)
                    dbResponseValue = dbResponse[keys[idx]].toISOString();
                else
                    dbResponseValue = String(dbResponse[keys[idx]]);

                expect(String(update[keys[idx]])).to.equal(dbResponseValue);
            }

            done();
        });
    });
}

// delete an existing object
function deleteExistingAndVerifyDeleted(endpointName, modelClass, fixtures, done)
{
    request(app)
    .del('/api/' + endpointName + '/' + fixtures[0]._id)
    .expect(204, function(err, response)
    {
        modelClass.count(function(err, count)
        {
            expect(count).to.equal(fixtures.length - 1);
            done();
        });
    });
}

// delete a non-existing object
function deleteNoneExistingAndVerifyResponse(endpointName, modelClass, done)
{
    request(app)
    .del('/' + endpointName + '/000000000000000000000000')
    .expect('Content-Type', /text/)
    .expect(404, done);
}

/*
 * Test patients API
 */
describe('Patients', function() 
{
    var fixtures = [];

    beforeEach(function(done)
    {
        fixtures = 
        [
            {
                name: "1_name",
                primary_phone: "+972546653001",
                email: "1@here.com"
            },

            {
                name: "2_name",
                primary_phone: "+972546653002",
                email: "2@here.com",
                appointment_price: 500
            },
        ];

        appointmentFixtures = 
        [
            {
                when: (new Date()).toISOString(),
                summary: "The guy is a cunt.",
                summary_sent: false,
                missed: false
            },

            {
                when: (new Date()).toISOString(),
                summary: "No hope for this one.",
                summary_sent: true,
                missed: false,
                price: 600
            },
        ];

        // shove patients in. this updates teh fixtures with their id
        dropCollectionAndInsertFixtures(Patient, 'patients', fixtures, function()
        {
            // map appointments to patients
            appointmentFixtures[0].patient = fixtures[0]._id;
            appointmentFixtures[1].patient = fixtures[0]._id;

            // now shove appointments
            dropCollectionAndInsertFixtures(Appointment, 'appointments', appointmentFixtures, done);
        });
    });

    describe('GET /api/patients', function() 
    {
        it('should return all patients', function(done)
        {
            getAllAndCompareToFixtures('patients', Patient, fixtures, done);
        });
    });

    describe('GET /api/patients/<id>', function()
    {
        describe('when requesting a patient with a valid id', function() 
        {
            it('should return a single patient', function(done)
            {
                getOneAndCompareToFixture('patients', Patient, fixtures[0], done);
            });
        });

        describe('when requesting a patient with a valid id, and requesting its appointments', function() 
        {
            it('should return a single patient with all its appointments', function(done)
            {
                    request(app)
                    .get('/api/patients/' + fixtures[0]._id + '?appointments=true')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, response)
                    {
                        if (err) return done(err);
                        deepCompareFixtureAndResponse(appointmentFixtures, response.body.appointments);
                        done();
                    });

            });
        });

        describe('when requesting a patient whose fixture omits a value which should be received as a default', function() 
        {
            it('should return a single patient', function(done)
            {
                request(app)
                .get('/api/patients/' + fixtures[0]._id)
                .end(function(err, response)
                {
                    if (err) return done(err);

                    // verify the response has a default price
                    expect(response.body.appointment_price).to.equal(330);

                    done();
                });
            });
        });

        describe('when requesting a patient with an invalid id', function() 
        {
            it('should return 404', function(done)
            {
                getInvalidOneAndVerifyNotFound('patients', Patient, done);
            });
        });
    });

    describe('POST /api/patients', function() 
    {
        describe('when creating a new resource /patients', function() 
        {
            it('should respond with 201 and create an object', function(done) 
            {
                var newPatient = 
                {
                    name: 'New patient',
                    primary_phone: "+972546653003",
                    email: 'new@guy.com'
                };

                postNewAndVerifyCreation('patients', Patient, newPatient, function(err, response)
                {
                    done(err);
                });
            });
        });
    });

    describe('PUT /api/patients', function() 
    {
        describe('when updating a resource /patients', function() 
        {
            it('should respond with 204 and update the object', function(done) 
            {
                var updatedPatient = 
                {
                    name: 'Updated patient',
                    primary_phone: "+972546653004",
                    email: 'updated@mail.com'
                };

                updateAndVerifyUpdate('patients', Patient, fixtures[0], updatedPatient, done);
            });
        });
    });

    describe('DELETE /api/patients/:id', function() 
    {
        describe('when deleting an existing patient', function() 
        {
            it('should respond with 204', function(done) 
            {
                deleteExistingAndVerifyDeleted('patients', Patient, fixtures, done);
            });
        });

        describe('when deleting an inexistent patient', function() 
        {
            it('should respond with 404', function(done)
            {
                deleteNoneExistingAndVerifyResponse('patients', Patient, done);
            });
        });
    });
});

/*
 * Test appointments API
 */
describe('Appointments', function() 
{
    var patientFixtures = [];
    var fixtures = [];

    beforeEach(function(done)
    {
        // update fixtures because we're modifying them with ids
        fixtures = 
        [
            {
                when: (new Date()).toISOString(),
                summary: "The guy is a cunt.",
                summary_sent: false,
                missed: false
            },

            {
                when: (new Date()).toISOString(),
                summary: "No hope for this one.",
                summary_sent: true,
                missed: false,
                price: 600
            },
        ];

        patientFixtures =
        [
            {
                name: "1_name",
                primary_phone: "+972546653001",
                email: "1@here.com"
            },

            {
                name: "2_name",
                primary_phone: "+972546653002",
                email: "2@here.com",
                appointment_price: 500
            },
        ];

        // shove patients in. this updates teh fixtures with their id
        dropCollectionAndInsertFixtures(Patient, 'patients', patientFixtures, function()
        {
            // map appointments to patients
            fixtures[0].patient = patientFixtures[0]._id;
            fixtures[1].patient = patientFixtures[1]._id;

            // now show appointments
            dropCollectionAndInsertFixtures(Appointment, 'appointments', fixtures, done);
        });
    });

    describe('GET /api/appointments', function() 
    {
        it('should return all appointments', function(done)
        {
            getAllAndCompareToFixtures('appointments', Appointment, fixtures, done);
        });

        it('should return appointments maching a query', function(done)
        {
            request(app)
            .get('/api/appointments?price={gte}500')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, response)
            {
                if (err) return done(err);
                expect(response.body[0]._id).to.equal(fixtures[1]._id);
                done();
            });
        });

        it('should return appointments maching a date query', function(done)
        {
            request(app)
            .get('/api/appointments?when={gte}' + Date.now())
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, response)
            {
                if (err) return done(err);
                expect(response.body).to.have.length(0);

                request(app)
                .get('/api/appointments?when={lte}' + Date.now())
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, response)
                {
                    if (err) return done(err);
                    expect(response.body).to.have.length(2);
                    done();
                });
            });
        });

        it('should return appointments populated with patient data', function(done)
        {
            request(app)
            .get('/api/appointments?populate_patient=true&price={lte}400')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, response)
            {
                if (err) return done(err);
                expect(response.body).to.have.length(1);
                compareFixtureToResponse(patientFixtures[0], response.body[0].patient);
                done();
            });
        });
    });

    describe('GET /api/appointments/<id>', function()
    {
        describe('when requesting a appointment with a valid id', function() 
        {
            it('should return a single appointment', function(done)
            {
                getOneAndCompareToFixture('appointments', Appointment, fixtures[0], done);
            });
        });

        describe('when requesting a appointment with an invalid id', function() 
        {
            it('should return 404', function(done)
            {
                getInvalidOneAndVerifyNotFound('appointments', Appointment, done);
            });
        });
    });

    describe('POST /api/appointments', function() 
    {
        describe('when creating a new resource /appointments', function() 
        {
            it('should respond with 201 and create an object', function(done) 
            {
                var newAppointment = 
                {
                    patient: patientFixtures[0]._id,
                    when: (new Date()).toISOString(),
                    summary: 'Why did I choose this profession?',
                    summary_sent: false,
                    missed: false,
                    price: 605
                };

                postNewAndVerifyCreation('appointments', Appointment, newAppointment, function(err, response)
                {
                    done(err);
                });
            });
        });
    });

    describe('PUT /api/appointments', function() 
    {
        describe('when updating a resource /appointments', function() 
        {
            it('should respond with 204 and update the object', function(done) 
            {
                var updatedAppointment = 
                {
                    when: (new Date()).toISOString(),
                    summary: 'I hope he dies.',
                    summary_sent: true,
                    missed: true,
                    price: 1000
                };

                updateAndVerifyUpdate('appointments', Appointment, fixtures[0], updatedAppointment, done);
            });
        });
    });

    describe('DELETE /api/appointments/:id', function() 
    {
        describe('when deleting an existing appointment', function() 
        {
            it('should respond with 204', function(done) 
            {
                deleteExistingAndVerifyDeleted('appointments', Appointment, fixtures, done);
            });
        });

        describe('when deleting an inexistent appointment', function() 
        {
            it('should respond with 404', function(done)
            {
                deleteNoneExistingAndVerifyResponse('appointments', Appointment, done);
            });
        });
    });
});

/*
 * Test payments API
 */
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
                primary_phone: "+972546653001",
                email: "1@here.com"
            },

            {
                name: "2_name",
                primary_phone: "+972546653002",
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
                dropCollectionAndInsertFixtures(Patient, 'patients', patientFixtures, callback);
            },

            function(callback)
            {
                // update patient references in payments
                attachReferences(fixtures, ['patient']);

                // shove payments
                dropCollectionAndInsertFixtures(Payment, 'payments', fixtures, callback);
            },

            function(callback)
            {
                // update patient, payment references in appointments
                attachReferences(appointmentFixtures, ['patient', 'payment']);

                // shove appointments
                dropCollectionAndInsertFixtures(Appointment, 'appointments', appointmentFixtures, done);
            }
        ]);
    });

    describe('GET /api/payments', function() 
    {
        it('should return all payments', function(done)
        {
            getAllAndCompareToFixtures('payments', Payment, fixtures, done);
        });
    });

    describe('GET /api/payments/<id>', function()
    {
        describe('when requesting a payment with a valid id', function() 
        {
            it('should return a single payment', function(done)
            {
                getOneAndCompareToFixture('payments', Payment, fixtures[0], done);
            });
        });

        describe('when requesting a payment with an invalid id', function() 
        {
            it('should return 404', function(done)
            {
                getInvalidOneAndVerifyNotFound('payments', Payment, done);
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

            postNewAndVerifyCreation('payments', Payment, newPayment, function(err, response)
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

                updateAndVerifyUpdate('payments', Payment, fixtures[0], updatedPayment, done);
            });
        });
    });

    describe('DELETE /api/payments/:id', function() 
    {
        describe('when deleting an existing payment', function() 
        {
            it('should respond with 204', function(done) 
            {
                deleteExistingAndVerifyDeleted('payments', Payment, fixtures, done);
            });
        });

        describe('when deleting an inexistent payment', function() 
        {
            it('should respond with 404', function(done)
            {
                deleteNoneExistingAndVerifyResponse('payments', Payment, done);
            });
        });
    });
});