var GoogleStrategy  = require('passport-google-oauth').OAuth2Strategy;

// load up the user model
var User = require('../models/user');

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
        clientID: process.env.AUTH_GOOGLE_OAUTH_CLIENT_ID || 'local',
        clientSecret: process.env.AUTH_GOOGLE_OAUTH_CLIENT_SECRET || 'local',
        callbackURL: process.env.ROOT_URL + '/login/callback'
    },
    function(token, refreshToken, profile, done) 
    {
        function getAuthorizedUsers()
        {
            if (!process.env.AUTH_ALLOWED_USERS)
                return [];
            else
                return process.env.AUTH_ALLOWED_USERS.split(",");
        }

        // get who is allowed to log in
        allowedUsers = getAuthorizedUsers();

        // check if allowed
        console.log(allowedUsers);
        console.log(profile.id);
        console.log(profile);

        // check if user is allowed
        if (allowedUsers.indexOf(profile.id) == -1)
            return done(new Error("Not allowed"));

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