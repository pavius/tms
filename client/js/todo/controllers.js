angular.module('tms.todo.controllers', [])

.config(['$routeProvider', function ($routeProvider) 
{
}])

.controller('TodoModalController',
            ['$scope', '$modalInstance', '$interval', 'Todo', 'mode', 'todo',
            function($scope, $modalInstance, $interval, Todo, mode, todo)
{
    $scope.todo = todo;

    $scope.createOrUpdate = function()
    {
        // are we creating?
        if (mode == 'create')
        {
            // update in server
            Todo.resource.save($scope.todo, function(updatedTodo)
                {
                    $modalInstance.close({updatedTodo: updatedTodo, status: 'create'});
                },
                function(error)
                {
                    $modalInstance.close({status: 'Error creating todo'});
                });
        }
        else
        {
            $modalInstance.close({status: 'Invalid mode'});
        }
    };

    $scope.cancel = function()
    {
        $modalInstance.dismiss({result: 'cancelled'});
    };
}]);
