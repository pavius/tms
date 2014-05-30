require('newrelic');
var _ = require('underscore');
var express = require('express');
var app = express();
var mongoose = require('mongoose');
var passport = require('passport');
var flash = require('connect-flash');

// load auth strategies
require('./auth/passport')(passport);

// connect to database
mongoose.connect(process.env.DB_URL);

// configure middlewares
app.configure(function() 
{
    // express stuff
    app.set('views', 'client/views');
    app.set('view engine', 'jade');
    app.use(express.static('client'));
    app.use(express.logger('dev'));
    app.use(express.json());
    app.use(express.methodOverride());

    // passport stuff
    app.use(express.cookieParser());
    app.use(express.session({secret: process.env.EXPRESS_SESSION_SECRET}));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(flash());
});

// load routes from all modules
_.each(['auth', 'patient', 'appointment', 'payment', 'client'], function(route)
{
    require('./routes/' + route).addRoutes(app, passport);
});

//
// Start the server
//

var port = process.env.PORT || 8080;

// if we're in development, load fixtures
app.configure('development', function()
{
    var fixtures = require('../db/fixtures/fixtures');

    // load fixtures
    fixtures.load(function()
    {
        // start the app
        app.listen(port);
    });
});

// if we're in production, just start the app
app.configure('production', function()
{
    // start the app
    app.listen(port);
});

module.exports = app;