var routeCommon = require('./common/common');

module.exports.addRoutes = function(app, security)
{
    // partials
    app.get('/partials/:name', routeCommon.isLoggedInRedirect, function(request, response)
    {
        response.render('partials/' + request.params.name);
    });

    // root access to the application
    app.get('/*', routeCommon.isLoggedInRedirect, function(request, response)
    {
        response.render('index');
    });
};