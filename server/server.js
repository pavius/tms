/*
 * Set up
 */
var _ = require('underscore');
var express = require('express');
var app = express();
var mongoose = require('mongoose');
var port = process.env.PORT || 8080;
var database = require('./config/database');
var fixtures = require('./db/fixtures/fixtures');
var passport = require('passport');
var flash = require('connect-flash');

/*
 * Configuration
 */

// require('./config/passport')(passport);

// mongoose.set('debug', true);
mongoose.connect(database.url);

app.configure(function() 
{
    // express stuff
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.static(__dirname + '/public'));
    app.use(express.logger('dev'));
    app.use(express.json());
    app.use(express.methodOverride());

    // passport stuff
    app.use(express.cookieParser());
    app.use(express.session({secret: 'zwEXo0VzCXwrpozUZpnU'}));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(flash());
});

/*
 * Routes
 */

_.each(['patient', 'appointment', 'payment'], function(route)
{
    require('./src/routes/' + route).addRoutes(app, passport);
});

/*
 * Load fixtures
 */
fixtures.load(function()
{
    /*
     * Start the app
     */
    app.listen(port);
});

module.exports = app;
