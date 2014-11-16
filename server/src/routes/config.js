var routeCommon = require('./common/common');

module.exports.addRoutes = function(app, security)
{
    app.get('/api/config', routeCommon.isLoggedInSendError, function(request, response)
    {
        config = {
            "system": {
                "name": process.env.CFG_SYSTEM_NAME
            },
            "user": {
                "name": process.env.CFG_USER_NAME
            },
            "enabledFeatures": process.env.CFG_ENABLED_FEATURES.split(",")
        }

        response.json(config);
    });
};
