var mongoose = require('mongoose');
var async = require('async');
_ = require('underscore');
loremIpsum = require('lorem-ipsum');

var Patient = require('../../src/models/patient');
var Appointment = require('../../src/models/appointment');
var Payment = require('../../src/models/payment');

patients =
[
    {
        name: "אדולף",
        primaryPhone: "054 123 4567",
        email: "mein.mail@here.com",
        payments:
        [
            {
                when: (new Date()).toISOString(),
                sum: 330
            }
        ],
        appointments:
        [
            {
                when: (generateRandomDateFromNow(-1000, 0)).toISOString(),
                summary: "The guy is a cunt.",
                summarySent: false,
                missed: false
            },
            {
                when: (generateRandomDateFromNow(0, 10000)).toISOString(),
                summary: "No hope for this one.",
                summarySent: true,
                missed: false,
                price: 600
            }
        ]
    },
    {
        name: "נועם",
        primaryPhone: "054 123 4567",
        email: "kiddie.luv22@gmail.com",
        appointmentPrice: 500,
        appointments:
        [
            {
                when: (new Date()).toISOString(),
                summary: "Blah",
                summarySent: true,
                missed: true
            }
        ]
    },
    {
        name: "עוד מישהו",
        primaryPhone: "054 123 4567",
        email: "whut@here.com",
        appointments:
        [
            {
                when: (generateRandomDateFromNow(-1000, 0)).toISOString(),
                summary: "Something",
                summarySent: false,
                missed: false
            },
            {
                when: (generateRandomDateFromNow(-1000, 0)).toISOString(),
                summary: "Whut",
                summarySent: false,
                missed: false
            },
            {
                when: (generateRandomDateFromNow(0, 10000)).toISOString(),
                summary: "Blah",
                summarySent: false,
                missed: false
            }
        ]
    }
];

function generateRandomNumber(min, max)
{
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function generateRandomDateFromNow(min, max)
{
    now = new Date();

    now.setMinutes(now.getMinutes() + generateRandomNumber(min, max));

    return now;
}

function dropCollections(callback)
{
    var collections = _.keys(mongoose.connection.collections);

    async.forEach(collections, function(collectionName, done)
    {
        var collection = mongoose.connection.collections[collectionName];

        collection.drop(function(err)
        {
            if (err && err.message != 'ns not found') done(err);
            else done(null);
        });
    }, callback);
}

function randomWords(count)
{
    return loremIpsum({count: count, units: 'words'});
}

function autoGenerateFixtures()
{
    // add 50 patients
    for (var idx = 0; idx < 6; ++idx)
    {
        patient =
        {
            name: randomWords(2),
            primaryPhone: "0541234567",
            email: randomWords(1) + '@' + randomWords(1) + '.com'
        };

        patients.push(patient);
    }
}

function loadFixtures(modelClass, fixtures, callback)
{
    objectsLeft = fixtures.length;

    // shove patients
    async.forEach(fixtures, function(fixture, done)
    {
        modelClass.create(fixture, function(dbErr, dbObject)
        {
            if (dbErr)  done(dbErr);
            else
            {
                fixture._id = dbObject._id;
                done(null);
            }
        });
    }, function(result)
    {
        if (callback !== null && callback !== undefined)
            callback(result);
    });
}

exports.load = function(callback)
{
    dropCollections(function()
    {
        // auto generate fixtures
        autoGenerateFixtures();

        // shove patients
        loadFixtures(Patient, patients, function(err)
        {
            if (callback !== undefined && callback !== null)
                callback(err);
        });
    });
};