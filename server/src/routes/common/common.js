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

function isLoggedIn(request, response, next)
{
    if (process.env.NODE_ENV == 'development' || 
        process.env.NODE_ENV == 'test' || 
        request.isAuthenticated())
    {
        return next();
    }
    else
    {
        response.redirect('/login');
    } 
}

exports.handleGetAllDontRespondOnSuccess = handleGetAllDontRespondOnSuccess;
exports.handleGetAll = handleGetAll;
exports.handleGetOneDontRespondOnSuccess = handleGetOneDontRespondOnSuccess;
exports.handleGetOne = handleGetOne;
exports.handleCreateDontRespondOnSuccess = handleCreateDontRespondOnSuccess;
exports.handleCreate = handleCreate;
exports.handleUpdate = handleUpdate;
exports.handleDelete = handleDelete;
exports.isLoggedIn = isLoggedIn;
