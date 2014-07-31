var _ = require('underscore');
var paramQuery = require('./paramquery');

// common functions
exports.handleGetAllDontRespondOnSuccess = function(modelClass, request, response, extendedQueries, callback)
{
    var query;

    // is there an extended query?
    if (extendedQueries)
    {
        // get extended queries, if any
        query = _.find(Object.keys(extendedQueries), function (key) {
            return key in request.query
        });

        if (query)
        {
            // get extended query arguments
            var args = JSON.parse(request.query[query]);

            if (args)
            {
                // get query string
                query = extendedQueries[query](args);

                modelClass.find(query, function (dbError, dbResponse) {
                    var validDbResponse = null;

                    if (dbError)    response.json(403, dbError);
                    else            validDbResponse = dbResponse;

                    callback(validDbResponse);
                });
            }
            else query = null;
        }
    }
    // if a query object wasn't created, use paramquery
    if (!query)
    {
        onResult = function(dbError, dbResponse)
        {
            var validDbResponse = null;

            if (dbError)    response.json(403, dbError);
            else            validDbResponse = dbResponse;

            callback(validDbResponse);
        };

        paramQuery.query(modelClass, request.query, onResult);
    }
}

exports.handleGetAll = function(modelClass, request, response, extendedQueries)
{
    module.exports.handleGetAllDontRespondOnSuccess(modelClass, request, response, extendedQueries, function(validDbResponse)
    {
        if (validDbResponse !== null)
            response.json(validDbResponse);
    });
}

// gets one and if not valid, responds. otherwise returns the object
exports.handleGetOneDontRespondOnSuccess = function(modelClass, request, response, callback)
{
    // shove id
    request.query._id = request.params.id;

    // use query so that select is honored. inject the id as a param
    paramQuery.query(modelClass, request.query, function(dbError, dbResponse) 
    {
        var validDbResponse = null;

        if (dbError)                            response.json(403, dbError);
        else if (dbResponse.length === 0)       response.send(404);
        else                                    validDbResponse = dbResponse[0];

        callback(validDbResponse);
    });
}

exports.handleGetOne = function(modelClass, request, response)
{
    module.exports.handleGetOneDontRespondOnSuccess(modelClass, request, response, function(validDbResponse)
    {
        if (validDbResponse !== null)
            response.json(validDbResponse);    
    });
}

exports.handleCreateDontRespondOnSuccess = function(modelClass, request, response, callback)
{
    modelClass.create(request.body, function(dbError, dbResponse)
    {
        var validDbResponse = null;

        if (dbError)    response.json(403, dbError);
        else            validDbResponse = dbResponse;

        callback(validDbResponse);
    });
}

exports.handleCreate = function(modelClass, request, response)
{
    module.exports.handleCreateDontRespondOnSuccess(modelClass, request, response, function(validDbResponse)
    {
        if (validDbResponse !== null)
            response.json(201, validDbResponse);    
    });
}

exports.handleUpdate = function(modelClass, request, response)
{
    // remove 'id' from request body, if it exists
    delete request.body._id;

    modelClass.findByIdAndUpdate(request.params.id, request.body, function(dbError, dbResponse)
    {
        if (dbError)                response.json(403, dbError);
        else                        response.json(200, dbResponse);
    });
}

exports.handleDelete = function(modelClass, request, response)
{
    modelClass.remove({_id: request.params.id}, function(dbError, dbResponse)
    {
        if (dbError)            response.json(403, dbError);
        else if (!dbResponse)   response.send(404);
        else                    response.send(204);
    });
}

function verifyLoggedIn(request, response, errorScheme, next)
{
    if (process.env.NODE_ENV == 'development' ||
        process.env.NODE_ENV == 'test' || 
        request.isAuthenticated())
    {
        return next();
    }
    else
    {
        if (errorScheme == 'redirect')
            response.redirect('/login');
        else
            response.send(401);
    }
}

exports.isLoggedInRedirect = function(request, response, next)
{
    // check if logged in and redirect to /login otherwise
    return verifyLoggedIn(request, response, 'redirect', next);
}

exports.isLoggedInSendError = function(request, response, next)
{
    // check if logged in and return error otherwise
    return verifyLoggedIn(request, response, 'error', next);
}

exports.updateDocument = function(doc, SchemaTarget, data)
{
    for (var field in SchemaTarget.schema.paths)
    {
        if ((field !== '_id') && (field !== '__v'))
        {
            var newValue = getObjValue(field, data);
            if (newValue !== undefined)
            {
                setObjValue(field, doc, newValue);
            }
        }
    }
    return doc;
};

function getObjValue(field, data)
{
    return _.reduce(field.split("."), function(obj, f)
    {
        if(obj) return obj[f];
    }, data);
}

function setObjValue(field, data, value)
{
    var fieldArr = field.split('.');
    return _.reduce(fieldArr, function(o, f, i)
    {
        if(i == fieldArr.length-1)
        {
            o[f] = value;
        } else
        {
            if(!o[f]) o[f] = {};
        }
        return o[f];
    }, data);
}
