exports.query = function (model, rawParams, cb)
{
    var params = buildQueryParams(model, rawParams);

    // Create the Mongoose Query object.
    query = model.find(params.searchParams);

    if (params.sort) query = query.sort(params.sort);

    query.select(params.select);

    if (cb)
    {
        query.exec(cb);
    }
    else
    {
        return query;
    }
};

function buildQueryParams(model, rawParams)
{
    var convertToBoolean = function(str)
    {
        if (str.toLowerCase() === "true" ||
            str.toLowerCase() === "t" ||
            str.toLowerCase() === "yes" ||
            str.toLowerCase() === "y" ||
            str === "1")
        {
            return true;
        }
        else
        {
            return false;
        }
    };

    var parseSchemaForKey = function(schema, keyPrefix, lcKey, val, operator)
    {
        var paramType = false;

        var addSearchParam = function (val)
        {
            var key = keyPrefix + lcKey;

            if (typeof searchParams[key] !== 'undefined')
            {
                for (var i in val)
                {
                    searchParams[key][i] = val[i];
                }
            }
            else
            {
                searchParams[key] = val;
            }
        };

        if (typeof schema === "undefined")
        {
            paramType = "String";

        }
        else if (typeof schema.paths[lcKey] === "undefined")
        {
            // nada, not found

        }
        else if (operator === "near")
        {
            paramType = "Near";
        }
        else if (schema.paths[lcKey].constructor.name === "SchemaBoolean")
        {
            paramType = "Boolean";
        }
        else if (schema.paths[lcKey].constructor.name === "SchemaString")
        {
            paramType = "String";
        }
        else if (schema.paths[lcKey].constructor.name === "SchemaNumber" ||
                 schema.paths[lcKey].constructor.name === "SchemaDate")
        {
            paramType = "Number";
        }
        else if (schema.paths[lcKey].constructor.name === "ObjectId")
        {
            paramType = "ObjectId";
        }

        if (paramType === "Boolean")
        {
            addSearchParam(convertToBoolean(val));
        }
        else if (paramType === "Number")
        {
            if (val.match(/([0-9]+,?)/) && val.match(','))
            {
                if (operator === "all")
                {
                    addSearchParam(
                    {
                        $all: val.split(',')
                    });
                }
                else if (operator === "nin")
                {
                    addSearchParam(
                    {
                        $nin: val.split(',')
                    });
                }
                else if (operator === "mod")
                {
                    addSearchParam(
                    {
                        $mod: [val.split(',')[0], val.split(',')[1]]
                    });
                }
                else
                {
                    addSearchParam(
                    {
                        $in: val.split(',')
                    });
                }
            }
            else if (val.match(/([0-9]+)/))
            {
                if (operator === "gt" ||
                    operator === "gte" ||
                    operator === "lt" ||
                    operator === "lte" ||
                    operator === "ne")
                {
                    var newParam = {};
                    newParam["$" + operator] = val;
                    addSearchParam(newParam);
                }
                else
                {
                    addSearchParam(parseInt(val));
                }
            }
        }
        else if (paramType === "String")
        {
            if (val.match(','))
            {
                var options = val.split(',').map(function (str)
                {
                    return new RegExp(str, 'i');
                });

                if (operator === "all")
                {
                    addSearchParam(
                    {
                        $all: options
                    });
                }
                else if (operator === "nin")
                {
                    addSearchParam(
                    {
                        $nin: options
                    });
                }
                else
                {
                    addSearchParam(
                    {
                        $in: options
                    });
                }
            }
            else if (val.match(/^[0-9]+$/))
            {
                if (operator === "gt" ||
                    operator === "gte" ||
                    operator === "lt" ||
                    operator === "lte")
                {
                    var someParam = {};
                    someParam["$" + operator] = val;
                    addSearchParam(someParam);
                }
                else
                {
                    addSearchParam(val);
                }
            }
            else if (operator === "ne" || operator === "not")
            {
                var neregex = new RegExp(val, "i");
                addSearchParam(
                {
                    '$not': neregex
                });
            }
            else if (operator === "exact")
            {
                addSearchParam(val);
            }
            else
            {
                addSearchParam(
                {
                    $regex: val,
                    $options: "-i"
                });
            }
        }
        else if (paramType === "Near")
        {
            // divide by 69 to convert miles to degrees
            var latlng = val.split(',');
            var distObj = {
                $near: [parseFloat(latlng[0]), parseFloat(latlng[1])]
            };
            if (typeof latlng[2] !== 'undefined')
            {
                distObj.$maxDistance = parseFloat(latlng[2]) / 69;
            }
            addSearchParam(distObj);
        }
        else if (paramType === "ObjectId")
        {
            addSearchParam(val);
        }
    };

    var parseParam = function(key, val)
    {
        var lcKey = key,
            operator = val.match(/\{(.*)\}/);

        val = val.replace(/\{(.*)\}/, '');

        if (operator) operator = operator[1];

        if (val === "")
        {
            return;
        }
        else if (lcKey === "page")
        {
            page = val;
        }
        else if (lcKey === "per_page")
        {
            per_page = val;
        }
        else if (lcKey === "sort_by")
        {
            var parts = val.split(',');
            sort = {};
            sort[parts[0]] = parts.length > 1 ? parts[1] : 1;
        }
        else if (lcKey === "select")
        {
            select += val;
        }
        else
        {
            parseSchemaForKey(model.schema, "", lcKey, val, operator);
        }
    };

    var searchParams = {}, query, page = 1, per_page = 10, sort = false, select = '';

    // Construct searchParams
    for (var key in rawParams)
    {
        var separatedParams = rawParams[key].match(/\{\w+\}(.[^\{\}]*)/g);

        if (separatedParams === null)
        {
            parseParam(key, rawParams[key]);
        }
        else
        {
            for (var i = 0, len = separatedParams.length; i < len; ++i)
            {
                parseParam(key, separatedParams[i]);
            }
        }
    }

    return {
        searchParams: searchParams,
        page: page,
        per_page: per_page,
        sort: sort,
        select: select
    };
}
