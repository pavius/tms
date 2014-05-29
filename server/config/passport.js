var GoogleStrategy  = require('passport-google-oauth').OAuth2Strategy;

// load up the user model
var User       = require('../models/user');

module.exports = function(passport) 
{
    // used to serialize the user for the session
    passport.serializeUser(function(user, done) 
    {
        done(null, user.id);
    });

    // used to deserialize the user
    passport.deserializeUser(function(id, done) 
    {
        User.findById(id, function(err, user) 
        {
            done(err, user);
        });
    });
    
    passport.use(new GoogleStrategy(
    {
        clientID: '',
        clientSecret: '',
        callbackURL: 'http://localhost:8080/login/callback',
    },
    function(token, refreshToken, profile, done) 
    {
        // try to find the user based on their google id
        User.findOne({'google.id': profile.id}, function(err, user) 
        {
            if (err) return done(err);

            if (user) 
            {
                // if a user is found, log them in
                return done(null, user);
            } 
            else 
            {
                // if the user isnt in our database, create a new user
                var newUser = new User();

                // set all of the relevant information
                newUser.google.id = profile.id;
                newUser.google.token = token;
                newUser.google.name = profile.displayName;
                newUser.google.email = profile.emails[0].value;

                // save the user
                newUser.save(function(err) 
                {
                    if (err) throw err;

                    return done(null, newUser);
                });
            }
        });
    }));
};