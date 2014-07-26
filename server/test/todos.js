// This is test/app.js
var request = require('supertest');
var expect = require('chai').expect;
var async = require('async');
var app = require('../src/server');
var common = require('./common');

var Todo = require('../src/models/todo');

/*
 * Test patients API
 */
describe('Todos', function()
{
    beforeEach(function(done)
    {
        todoFixtures = [
            {
                text: "Some todo"
            },
            {
                text: "Some todo",
                type: 'later'
            }
        ];

        common.dropCollections(['todos'], function(err)
        {
            async.each(todoFixtures, function(todoFixture, doneWithTodo)
            {
                Todo.create(todoFixture, function(dbErr, dbObject)
                {
                    if (dbErr) doneWithTodo(dbErr);
                    else
                    {
                        todoFixture._id = String(dbObject._id);
                        doneWithTodo();
                    }
                });

            }, done);
        });
    });

    describe('GET /api/todos', function()
    {
        it('should return all todos', function(done)
        {
            common.getAllAndCompareToFixtures(app, 
                                              'todos',
                                              null,
                                              Todo,
                                              todoFixtures,
                                              null,
                                              done);
        });
    });

    describe('GET /api/todos/<id>', function()
    {
        describe('when requesting a todo with a valid id', function() 
        {
            it('should return a single todo', function(done)
            {
                common.getOneAndCompareToFixture(app, 
                                                 'todos',
                                                 null,
                                                 Todo, 
                                                 todoFixtures[0],
                                                 null,
                                                 done);
            });
        });

        describe('when requesting a todo with an invalid id', function()
        {
            it('should return 404', function(done)
            {
                common.getInvalidOneAndVerifyNotFound(app, 'todos', Todo, done);
            });
        });
    });

    describe('POST /api/todos', function()
    {
        describe('when creating a new resource /todos', function()
        {
            it('should respond with 201 and create an object', function(done)
            {
                var newTodo =
                {
                    text: "Another todo",
                    type: 'later'
                };

                common.postNewAndVerifyCreation(app, 'todos', Todo, newTodo, null, function(err, response)
                {
                    done(err);
                });
            });
        });
    });

    describe('PUT /api/todos', function()
    {
        describe('when updating a resource /todos', function()
        {
            it('should respond with 204 and update the object', function(done)
            {
                var updatedTodo =
                {
                    text: "Updated todo",
                    type: 'later'
                };

                common.updateAndVerifyUpdate(app, 'todos', Todo, todoFixtures[0], updatedTodo, null, done);
            });
        });
    });

    describe('DELETE /api/todos/:id', function()
    {
        describe('when deleting an existing todo', function()
        {
            it('should respond with 204', function(done)
            {
                common.deleteExistingAndVerifyRemaining(app, 'todos', Todo, todoFixtures[0]._id, todoFixtures.length, done);
            });
        });

        describe('when deleting an inexistent todo', function()
        {
            it('should respond with 404', function(done)
            {
                common.deleteNoneExistingAndVerifyResponse(app, 'todos', Todo, done);
            });
        });
    });
});
