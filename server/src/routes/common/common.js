var _ = require('underscore');
var paramQuery = require('./paramquery');

// common functions
function handleGetAllDontRespondOnSuccess(modelClass, request, response, callback)
{
    onResult = function(dbError, dbResponse)
    {
        var validDbResponse = null;

        if (dbError)    response.json(403, dbError);
        else            validDbResponse = dbResponse;

        callback(validDbResponse);
    };

    // use query
    paramQuery.query(modelClass, request.query, onResult);
}

function handleGetAll(modelClass, request, response)
{
    handleGetAllDontRespondOnSuccess(modelClass, request, response, function(validDbResponse)
    {
        if (validDbResponse !== null)
            response.json(validDbResponse);
    });
}

// gets one and if not valid, responds. otherwise returns the object
function handleGetOneDontRespondOnSuccess(modelClass, request, response, callback)
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

function handleGetOne(modelClass, request, response)
{
    handleGetOneDontRespondOnSuccess(modelClass, request, response, function(validDbResponse)
    {
        if (validDbResponse !== null)
            response.json(validDbResponse);    
    });
}

function handleCreateDontRespondOnSuccess(modelClass, request, response, callback)
{
    modelClass.create(request.body, function(dbError, dbResponse)
    {
        var validDbResponse = null;

        if (dbError)    response.json(403, dbError);
        else            validDbResponse = dbResponse;

        callback(validDbResponse);
    });
}

function handleCreate(modelClass, request, response)
{
    handleCreateDontRespondOnSuccess(modelClass, request, response, function(validDbResponse)
    {
        if (validDbResponse !== null)
            response.json(201, validDbResponse);    
    });
}

function handleUpdate(modelClass, request, response)
{
    // remove 'id' from request body, if it exists
    delete request.body._id;

    modelClass.findByIdAndUpdate(request.params.id, request.body, function(dbError, dbResponse)
    {
        if (dbError)                response.json(403, dbError);
        else                        response.json(200, dbResponse);
    });
}

function handleDelete(modelClass, request, response)
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
    if (/* process.env.NODE_ENV == 'development' || */
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
            response.send(302);
    }
}

function isLoggedInRedirect(request, response, next)
{
    // check if logged in and redirect to /login otherwise
    return verifyLoggedIn(request, response, 'redirect', next);
}

function isLoggedInSendError(request, response, next)
{
    // check if logged in and return error otherwise
    return verifyLoggedIn(request, response, 'error', next);
}

function updateDocument(doc, SchemaTarget, data)
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

exports.handleGetAllDontRespondOnSuccess = handleGetAllDontRespondOnSuccess;
exports.handleGetAll = handleGetAll;
exports.handleGetOneDontRespondOnSuccess = handleGetOneDontRespondOnSuccess;
exports.handleGetOne = handleGetOne;
exports.handleCreateDontRespondOnSuccess = handleCreateDontRespondOnSuccess;
exports.handleCreate = handleCreate;
exports.handleUpdate = handleUpdate;
exports.handleDelete = handleDelete;
exports.isLoggedInRedirect = isLoggedInRedirect;
exports.isLoggedInSendError = isLoggedInSendError;
exports.updateDocument = updateDocument;