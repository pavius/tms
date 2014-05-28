var routeCommon = require('./common/common');

module.exports.addRoutes = function(app, security)
{
    // login via google
    app.get('/login', security.authenticate('google', { scope : ['email'] }));

    // callback from google
    app.get('/login/callback',
            security.authenticate('google', 
            {
                    successRedirect : '/',
                    failureRedirect : '/login'
            }));
};