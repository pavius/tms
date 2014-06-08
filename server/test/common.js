var request = require('supertest');
var async = require('async');
var mongoose = require('mongoose');
var expect = require('chai').expect;

var Patient = require('../src/models/patient');

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
function compareFixtureToResponse(fixture, responseObject, schema)
{
    // make sure all fixture members are in the response. the response
    // may contain fields which were injected as defaults. also, if fixture
    // has an ObjectID, compare it as a string
    Object.keys(fixture).forEach(function(key)
    {
        var mode = 'verify';
        var fixtureValue = fixture[key];

        // is there anything in the schema for this key?
        if (schema !== null && schema !== undefined && schema.hasOwnProperty(key))
        {
            // mode override (skip / mustn't exist)
            if (schema[key].hasOwnProperty('mode'))
                mode = schema[key].mode;

            // check value override
            if (schema[key].hasOwnProperty('expect'))
                fixtureValue = schema[key].expect;
        }

        // verify teh key
        if (mode == 'verify')
        {
            // must exist in response
            expect(responseObject).to.have.property(key);

            // for object, compare recursively
            if (typeof fixtureValue === 'object')
            {
                var subSchema = null;

                if (schema !== null && schema !== undefined && schema.hasOwnProperty(key))
                    subSchema = schema[key];

                compareFixtureToResponse(fixtureValue, responseObject[key], subSchema);
            }
            else
            {
                // stringify both to prevent cases like object id where the value is a number,
                // but we expect a string
                expect(String(fixtureValue)).to.equal(String(responseObject[key]));
            }
        }
        else if (mode == 'mustntExist')
        {
            // must exist in response
            expect(responseObject).not.to.have.property(key);
        }
    });
}

// compare all fixtures to a response received from teh server
function compareFixturesToResponse(fixtures, response, schema)
{
    fixtures.forEach(function(fixture)
    {
        // look for this object by id in the response
        responseObject = findObjectInArrayByKey(response, '_id', fixture._id);

        // must exist
        expect(responseObject).to.not.equal(null);

        // compare the fixture
        compareFixtureToResponse(fixture, responseObject, schema);
    });
}

// drop multiple collections
function dropCollections(collections, callback)
{
    async.each(collections, function(collection, callback) 
    {
        mongoose.connection.collections[collection].drop(callback);
    },
    callback);
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

// drop all collections and inject new
function injectFixtures(patientFixtures, done)
{
    // drop everything
    dropCollections(['patients'], function(err)
    {
        async.each(patientFixtures, function(patientFixture, doneWithPatient)
        {
            // create the patient
            Patient.create(patientFixture, function(dbErr, dbObject)
            {
                patientFixture._id = String(dbObject._id);
                
                // save appointment id
                if (patientFixture.appointments !== null && patientFixture.appointments !== undefined)
                    for (var idx = 0; idx < patientFixture.appointments.length; ++idx)
                        patientFixture.appointments[idx]._id = String(dbObject.appointments[idx]._id);

                doneWithPatient();
            });
        },
        done);
    });
}

function getRequestParams(params)
{
    if (params !== null) return '?' + params;
    else                 return '';
}

// get and compare to fixtures
function getAllAndCompareToFixtures(app, endpointName, params, modelClass, fixtures, schema, done)
{
    request(app)
    .get('/api/' + endpointName + getRequestParams(params))
    .expect('Content-Type', /json/)
    .expect(200)
    .end(function(err, response)
    {
        if (err) return done(err);
        compareFixturesToResponse(fixtures, response.body, schema);
        done();
    });
}

// get one and compare to fixture
function getOneAndCompareToFixture(app, endpointName, params, modelClass, fixture, schema, done)
{
    request(app)
    .get('/api/' + endpointName + '/' + fixture._id + getRequestParams(params))
    .expect('Content-Type', /json/)
    .expect(200)
    .end(function(err, response)
    {
        if (err) return done(err);
        compareFixtureToResponse(fixture, response.body, schema);
        done();
    });
}

// get invalid one and compare to fixture
function getInvalidOneAndVerifyNotFound(app, endpointName, modelClass, done)
{
    request(app)
    .get('/api/' + endpointName + '/000000000000000000000000')
    .expect('Content-Type', /text/)
    .expect(404)
    .end(done);
}

// create an object and verify creation
function postNewAndVerifyCreationWithSpecified(app, endpointName, modelClass, modelData, expectedResponse, schema, callback)
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

            // compare response to that stored in database
            compareFixtureToResponse(expectedResponse, response.body, schema);

            callback(null, response.body);
        });
    });
}

// create an object and verify creation
function postNewAndVerifyCreation(app, endpointName, modelClass, modelData, schema, callback)
{
    postNewAndVerifyCreationWithSpecified(app, endpointName, modelClass, modelData, modelData, schema, callback);
}

// update a resource by id, check in the db that it was updated
function updateAndVerifyUpdate(app, endpointName, modelClass, modelData, update, schema, done)
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

            compareFixtureToResponse(update, response.body, schema);
            done();
        });
    });
}

// delete an existing object, expect no response
function deleteExistingAndVerifyResponse(app, endpointName, modelClass, id, expectedResponse, schema, callback)
{
    request(app)
    .del('/api/' + endpointName + '/' + id)
    .expect(200, function(err, response)
    {
        // compare the response to the fixture
        if (err) return callback(err, null);

        if (expectedResponse)
            compareFixtureToResponse(expectedResponse, response.body, schema);

        callback(err, response);
    });
}

// delete an existing object, expect no response
function deleteExistingAndVerifyRemaining(app, endpointName, modelClass, id, currentCount, done)
{
    request(app)
    .del('/api/' + endpointName + '/' + id)
    .expect(204, function(err, response)
    {
        // compare the response to the fixture
        if (err) return done(err);

        modelClass.count(function(err, count)
        {
            expect(count).to.equal(currentCount - 1);
            done();
        });
    });
}

// delete a non-existing object
function deleteNoneExistingAndVerifyResponse(app, endpointName, modelClass, done)
{
    request(app)
    .del('/' + endpointName + '/000000000000000000000000')
    .expect('Content-Type', /text/)
    .expect(404, done);
}

// export
exports.attachReferences = attachReferences;
exports.findObjectInArrayByKey = findObjectInArrayByKey;
exports.compareFixtureToResponse = compareFixtureToResponse;
exports.compareFixturesToResponse = compareFixturesToResponse;
exports.injectFixtures = injectFixtures;
exports.getAllAndCompareToFixtures = getAllAndCompareToFixtures;
exports.getOneAndCompareToFixture = getOneAndCompareToFixture;
exports.getInvalidOneAndVerifyNotFound = getInvalidOneAndVerifyNotFound;
exports.postNewAndVerifyCreationWithSpecified = postNewAndVerifyCreationWithSpecified;
exports.postNewAndVerifyCreation = postNewAndVerifyCreation;
exports.updateAndVerifyUpdate = updateAndVerifyUpdate;
exports.deleteExistingAndVerifyRemaining = deleteExistingAndVerifyRemaining;
exports.deleteNoneExistingAndVerifyResponse = deleteNoneExistingAndVerifyResponse;
exports.deleteExistingAndVerifyResponse = deleteExistingAndVerifyResponse;
exports.compareFixtureToResponse = compareFixtureToResponse;