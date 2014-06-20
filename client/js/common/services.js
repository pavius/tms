angular.module('tms.common.services', [])

.factory('ErrorHandler', ['$window', function($window)
{
    function ErrorHandler()
    {
        this.alerts = [];
    }

    ErrorHandler.prototype.openAlert = function(alertType, alertMessage)
    {
        this.alerts.push({type: alertType, message: alertMessage});
    }

    ErrorHandler.prototype.closeAlert = function(index)
    {
        this.alerts.splice(index, 1);
    }

    ErrorHandler.prototype.handleError = function(action, error)
    {
        // handle according to status
        if (error.status == 401)
        {
            $window.location.reload();
        }
        else
        {
            this.openAlert('danger', "Failed to " + action + ". Error: " + error.statusText);
        }
    }

    return new ErrorHandler();
}]);
