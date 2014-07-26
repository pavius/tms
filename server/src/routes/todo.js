var routeCommon = require('./common/common');
var Todo = require('../models/todo');

module.exports.addRoutes = function(app, security)
{
    // get all todos
    app.get('/api/todos', routeCommon.isLoggedInSendError, function(request, response)
    {
        routeCommon.handleGetAll(Todo, request, response);
    });

    // get a single todo
    app.get('/api/todos/:id', routeCommon.isLoggedInSendError, function(request, response)
    {
        routeCommon.handleGetOne(Todo, request, response);
    });

    // create todo
    app.post('/api/todos', routeCommon.isLoggedInSendError, function(request, response)
    {
        routeCommon.handleCreate(Todo, request, response);
    });

    // update a single todo
    app.put('/api/todos/:id', routeCommon.isLoggedInSendError, function(request, response)
    {
        // remove 'id' from request body, if it exists
        delete request.body._id;

        routeCommon.handleUpdate(Todo, request, response);
    });

    // delete a todo
    app.delete('/api/todos/:id', routeCommon.isLoggedInSendError, function(request, response)
    {
        routeCommon.handleDelete(Todo, request, response);
    });
};