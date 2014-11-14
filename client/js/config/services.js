angular.module('tms.config.services', [])

.factory('Configuration', ['$location', function($location)
{
    function Configuration()
    {
        this.current = this.loadConfiguration();
    }

    Configuration.prototype.featureEnabled = function(feature)
    {
        return (this.current.enabledFeatures.indexOf(feature) > -1);
    }

    Configuration.prototype.loadConfiguration = function()
    {
        // ugly hack for now
        if ($location.absUrl().indexOf("localhost") > -1)
        {
            return {
                "system": {
                    "name": "Yarden Management System"
                },
                "user": {
                    "name": 'ד"ר ירדן לוינסקי'
                },
                "enabledFeatures": []
            }
        }
        else
        {
            return {
                "system": {
                    "name": "Tali Management System"
                },
                "user": {
                    "name": 'טל קפלינסקי'
                },
                "enabledFeatures": ["issueInvoices"]
            }
        }
    }

    return new Configuration();
}]);
