/** global sprat namespace */
var sprat = sprat || {};

sprat.ui = sprat.ui || {};
sprat.ui.component = sprat.ui.component || {};

/**
 * Maps Spring Data REST or Spring Data HATEOAS endpoints to the jQuery DataTable plug-in.
 * @param {object} _defaults Datatable options
 * @return ComponentDataTable
 */
sprat.ui.component.dataTable = function (_defaults) {
    var ComponentDataTable = function (_defaults) {
        var self = this;
        self.defaults = _defaults || {};

        // private section
        var _internal = {
            cssClasses: {
                "isOrderable": "is-orderable",
                "isSearchable": "is-searchable"
            },
            attributes: {
                prefix: "sprat-datatable-",
                renderer: "renderer",
                property: "property",
                alias: "alias"
            }
        };

        /**
         * Internal utility methods for sprat.ui.component.dataTable
         */
        var util = {
            /**
             * Is the given attribute present in the provided jQuery element
             */
            isOptionPresent: function (jqElem, option) {
                return this.optionValue(jqElem, option) !== null;
            },
            /**
             * Is given CSS class present
             */
            isCssClassPresent: function (jqElem, clazz) {
                return jqElem.hasClass(_internal.attributes.prefix + clazz);
            },
            /**
             * Returns the value of HTML attribute. This methods prepends the "sprat-datatable-"
             * prefix.
             */
            optionValue: function (jqElem, option) {
                var r = jqElem.attr(_internal.attributes.prefix + option);

                if (r === undefined) {
                    return null;
                }

                return r;
            }
        };

        var instance = {
            /**
             * base URL for all REST queries
             */
            restEndpoint: null,
            /**
             * Array with URLs which can be used for altering the next GET request
             */
            endpointQueue: [],
            initialized: false,
            lastReceivedData: null,
            options: {
                springDataAttribute: null,
                requestParameters: {},
                datatable: {
                    "order": [0, "desc"],
                    "jQueryUI": false,
                    "stateSave": true,
                    "serverSide": true,
                    "ordering": true,
                    "paging": true,
                    "searching": false,
                    "pagingType": "full_numbers",
                    "language": {
                        "processing": "Verarbeite...",
                        "lengthMenu": '<span class="itemsPerPage">Eintr&auml;ge pro Seite:</span> <span style="font-size: 11px;">_MENU_</span>',
                        "zeroRecords": "Keine Eintr&auml;ge gefunden",
                        "emptyTable": "Keine Eintr&auml;ge vorhanden",
                        "loadingRecords": "Lade...",
                        "info": "Zeige _START_ bis _END_ von _TOTAL_ Eintr&auml;gen",
                        "infoEmpty": "Zeige 0 bis 0 von 0 Eintr&auml;gen",
                        "infoFiltered": "(_MAX_ insgesamt)",
                        "infoPostFix": "",
                        "thousands": ".",
                        "search": "Suche:",
                        "url": "",
                        "paginate": {
                            "first": "Erste",
                            "previous": "Vorherige",
                            "next": "N&auml;chste",
                            "last": "Letzte"
                        }
                    },
                }
            },
            columnDefinitions: [],
            mappedColumns: {},
            dataTable: null,
        };

        var datatableDefaults = {
            "ajax": function (data, callback, settings) {
                // page calculations
                var draw = data.draw;
                var pageSize = data.length;
                var start = data.start;
                var pageNum = (start === 0) ? 0 : (start / pageSize);
                var sorting = {dir: null};

                if (data.order && data.order.length >= 0) {
                    sorting = data.order[0];
                }

                var sortDir = sorting.dir;

                var sortCol = $(this).find("thead > tr > th").eq(sorting.column).attr(
                    _internal.attributes.prefix + _internal.attributes.property);

                var defaultRequest = {
                    "size": pageSize,
                    "page": pageNum
                };

                if (sortCol) {
                    defaultRequest.sort = sortCol + "," + sortDir;
                }

                var request = $.extend(true, defaultRequest, instance.options.requestParameters);
                var endpoint = self.getEndpoint();

                $rest.get(endpoint, request, function(afterReceive) {
                    var r = instance.convertResponseToDatatable(afterReceive, draw);
                    callback(r);
                });
            }
        };

        /**
         * Return last received data from backend, containing the whole AJAX response.
         * @return {object}
         */
        self.lastReceivedData = function () {
            return instance.lastReceivedData;
        };

        /**
         * Bind jQuery table element to the backing datatable
         * @param {object} _table jQuery element
         * @return ComponentDataTable
         */
        self.bindTable = function (_table) {
            if (!(_table instanceof jQuery)) {
                throw "bindTable argument must be a jQuery table element";
            }

            instance.table = _table;
            _table.data("sprat-datatable", self);

            return self;
        };

        /**
         * Bind table to given Spring Data REST endpoint
         * @param {string} _endpoint URL of Spring Data REST endpoint
         * @return ComponentDataTable
         */
        self.toEndpoint = function (_endpoint) {
            instance.restEndpoint = _endpoint;
            return self;
        };

        /**
         * Set the Spring Data REST "_embedded.*" key to lookup the data
         *
         * @param {string} _attribute
         * @return {ComponentDataTable}
         */
        self.withSpringDataAttribute = function (_attribute) {
            instance.options.springDataAttribute = _attribute;
            return self;
        };

        /**
         * Configure GET parameters for every request
         *
         * @param _parameters
         * @returns {ComponentDataTable}
         */
        self.withRequestParameters = function (_parameters) {
            instance.options.requestParameters = _parameters;
            return self;
        };

        /**
         * Map multiple columns to their corresponding renderer. You can use a numeric value (index based), a property name or an alias.
         *
         * @param {object} mappedColumns
         * @return ComponentDataTable
         */
        self.mapColumns = function (mappedColumns) {
            instance.mappedColumns = mappedColumns;
            return self;
        };

        /**
         * Set Datatable options
         *
         * @param {object} options
         * @return {ComponentDataTable}
         */
        self.datatableOptions = function (options) {
            instance.options.datatable = options;
            return self;
        };

        /**
         * Map on column to their corresponding renderer.
         *
         * @param {{numer|string}} columnIdx numeric value (index based) or string (property name or alias)
         * @param {object} mapColumn
         * @return self
         */
        self.mapColumn = function (columnIdx, mapColumn) {
            instance.mappedColumns[columnIdx] = mapColumn;
            return self;
        };

        /**
         * This callback is executed after a row has been rendered
         *
         * @param {function} callback
         * @return ComponentDataTable
         */
        self.afterCreatedRow = function (callback) {
            instance.options.datatable.createdRow = callback;
            return self;
        };

        /**
         * Return the DataTable instance
         * @return DataTable
         */
        self.dataTable = function () {
            if (!instance.initialized) {
                throw "DataTable not initialized. You must call build() before returning the datatable";
            }

            return instance.table.DataTable();
        };


        /**
         * Execute a reload of the underlying datatable. If it is not intialized yet, it gets initialized
         */
        self.reload = function() {
            if (!instance.initialized) {
                throw "DataTable not initialized. You must call build() before changing the source";
            }

            // underlying dataTable has not been initialized
            if (!instance.dataTable) {
                self.initDataTable();
                // no need to call .ajax.reload() b/c it is already done through initializing.
            }
            else {
                self.dataTable().ajax.reload();
            }
        };

        /**
         * Change the REST endpoint and do a reload of the backed table.
         * If the underlying DataTable is not already initialized, it will get initialized by calling self.initDataTable().
         * @param {string} source URL
         * @return ComponentDataTable
         */
        self.updateEndpoint = function (source) {
            if (!instance.initialized) {
                throw "DataTable not initialized. You must call build() before changing the source";
            }

            // self.dataTable().ajax.url(...) would change our callback handler.
            instance.restEndpoint = source;

            self.reload();
        };

        /**
         * Enqueues a new endpoint path which will be executed for the next request
         * @param {string} source URL
         * @param {boolean} execute reload instantly
         * @return ComponentDataTable
         */
        self.enqueueEndpoint = function(source, instantReload) {
            instance.endpointQueue.push(source);

            if (instantReload) {
                self.reload();
            }

            return self;
        };

        /**
         * Return the next executable endpoint
         * @return string
         */
        self.getEndpoint = function() {
            if (instance.endpointQueue.length > 0) {
                return instance.endpointQueue.pop();
            }

            // fallback to the default endpoint
            return instance.restEndpoint;
        };

        /**
         * Return instance and its configuration
         * @return ComponentDataTable
         */
        self.config = function() {
            return instance;
        };

        /**
         * Initialize the datatable. Throw an error if it is already initialized
         * @return ComponentDataTable
         */
        self.initDataTable = function() {
            if (instance.dataTable) {
                throw "DataTable of this instance is already initialized";
            }

            // create datatable instance
            instance.dataTable = instance.table.dataTable(instance.options.datatable);
            return self;
        };

        /**
         * Build datatable
         * @param {boolean} initialize if given and false then the datatable is not initialized. If this option is missed, the datatable gets initialized automatically
         * @return ComponentDataTable
         */
        self.build = function () {
            // inherit default options
            $.extend(true, instance.options.datatable, self.defaults, datatableDefaults);

            if (!instance.table) {
                throw "Datatable has not been bound by calling bindTable()";
            }

            if (!instance.restEndpoint) {
                throw "REST endpoint has not been configured by calling toEndpoint()";
            }

            /**
             * Updates the instance.columnDefinitions. Should only be called once on
             * initializing. Please use .initialize()
             */
            instance.buildColumnDefinitions = function () {
                if (instance.initialized) {
                    return;
                }

                var definitions = [];


                // find header descriptions
                instance.table.find("thead > tr > th").each(function (idx, value) {
                    var attributeValue = null;
                    // defaults
                    var spec = {
                        "targets": idx,
                        "orderable": false,
                        "searchable": false,
                        "data": null,
                    };

                    // class="sprat-datatable-is-orderable" has been set
                    if (util.isCssClassPresent($(this), _internal.cssClasses.isOrderable)) {
                        spec.orderable = true;
                    }

                    if (util.isCssClassPresent($(this), _internal.cssClasses.isSearchable)) {
                        spec.searchable = true;
                    }

                    // sprat-datatable-renderer has been set
                    if (null !== (customRenderer = util.optionValue($(this), _internal.attributes.renderer))) {
                        if (!sprat.ui || !sprat.ui.renderer) {
                            throw "You are using a customer renderer but sprat.ui has not been included. Add <script src='$SPRAT_PATH/dist/ui/renderer.js'></script> to your HTML file";
                        }

                        spec.render = sprat.ui.renderer.get(customRenderer, instance);
                    }

                    // sprat-datatable-property
                    if (null !== (attributeValue = util.optionValue($(this), _internal.attributes.property))) {
                        spec.name = attributeValue;
                        spec.data = attributeValue;
                    }

                    // sprat-datatable-alias has been set
                    var useAlias = util.optionValue($(this), _internal.attributes.alias) || -1;

                    // check programatically configuration of this table.
                    var configuredRenderer = instance.mappedColumns[useAlias] || instance.mappedColumns[idx];

                    if (configuredRenderer) {
                        spec.render = configuredRenderer;
                    }

                    if (!spec.render) {
                        console.warn("Column idx" + idx + " has no renderer. Using default renderer");
                        spec.render = function (data, type, full, last) {
                            return data;
                        };
                    }

                    definitions.push(spec);
                });

                instance.initialized = true;
                return definitions;
            };

            /**
             * Will be executed after data has been received from REST endpoint
             *
             * @param {object} json JSON data retrieved from the endpoint
             * @param {object} draw
             *            jQuery DataTable object
             */
            instance.convertResponseToDatatable = function (json, draw) {
                instance.lastReceivedData = json;

                // we use JSONSelect for selecting JSON elements
                var recordsTotalSelector = ".totalElements";
                var recordsFilteredSelector = ".totalElements";
                // assume that the content is stored in the array with the JSON property name "content"
                var dataSelector = "array.content";

                var r = {
                    "recordsTotal": 0,
                    "recordsFiltered": 0,
                    "data": [],
                    "draw": draw
                };

                if (instance.options.springDataAttribute) {
                    dataSelector = "._embedded ." + instance.options.springDataAttribute;
                }

                if (instance.options.datatable.selector) {
                    recordsTotalSelector = instance.options.datatable.selector.recordsTotal || recordsTotalSelector;
                    recordsFilteredSelector = instance.options.datatable.selector.recordsFiltered || recordsFilteredSelector;
                    dataSelector = instance.options.datatable.selector.data = dataSelector;
                }

                if (!dataSelector) {
                    throw "No dataSelector set";
                }

                if (window.JSONSelect) {
                    r.recordsFiltered = window.JSONSelect.match(recordsFilteredSelector, json)[0];
                    r.recordsTotal = window.JSONSelect.match(recordsTotalSelector, json)[0];

                    // only filter any data if data is really available
                    if (r.recordsTotal > 0) {
                        var matchedData = window.JSONSelect.match(dataSelector, json);
                        r.data = matchedData[0];

                        if (undefined === r.data) {
                            throw "Could not find any data for selector '" + dataSelector + "'. Check your selector for any typos. Maybe you are missing a withSpringDataAttribute() call?";
                        }
                    }
                } else {
                    throw "No JSONSelect on path (http://jsonselect.org/)";
                }

                return r;
            };

            instance.options.datatable.columnDefs = instance.buildColumnDefinitions();

            if (!instance.table.dataTable) {
                throw "sprat.ui.component.dataTable requires DataTables (https://www.datatables.net/).";
            }

            var initializeDataTable = true;

            // if first parameter is passed (initialized datatable: boolean), load it
            if (arguments.length > 0) {
                initializeDataTable = arguments[0];
            }

            if (initializeDataTable) {
                self.initDataTable();
            }

            return self;
        };

        return self;
    };

    return new ComponentDataTable(_defaults);
};