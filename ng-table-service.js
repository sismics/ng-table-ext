'use strict';

angular
    .module('ngTableExt', [])
    .service('TableService', function (NgTableParams, $translate, $location) {
        var self = this;

        /**
         * Use this constructor to build standard tables with persistence to session storage.
         *
         * @param params
         * @param settings
         */
        this.restoreTableParams = function(params, settings) {
            var savedParams = JSON.parse(sessionStorage.getItem(getDataTableKey()));
            savedParams = savedParams != null ? getSaveData(savedParams) : params;
            return self.getTableParams(savedParams, settings);
        };

        /**
         * Use this constructor to build standard tables throughout the application.
         *
         * @param params
         * @param settings
         */
        this.getTableParams = function(params, settings) {
            var defaultCount = 10;

            var defaultParams = {
                page: 1,
                count: defaultCount
            };

            var defaultSettings = {
                total: 0,
                defaultSort: 'asc',
                counts: [defaultCount, 25, 50, 100, 10000],
                all: 10000,
                allLabel: $translate.instant('table_page_all'),
                alwaysShowPager: true
            };

            var origGetData = settings.getData;
            var tableParams = new NgTableParams(
                angular.extend(defaultParams, params),
                angular.extend(defaultSettings, angular.extend(settings, {
                    getData: function(params) {
                        self.saveData(params._params);
                        return origGetData(params);
                    }
                })));

            /**
             * Show pager.
             *
             * @returns {boolean}
             */
            tableParams.showPager = function() {
                return this.settings().alwaysShowPager ||
                    this.total() > this.count()
            };

            tableParams.pageStart = function() {
                return (this.page() - 1) * this.count() + 1;
            };

            tableParams.pageEnd = function() {
                return (this.page() - 1) * this.count() + this.data.length;
            };

            /**
             * Checks if several items are selected.
             *
             * @returns Condition
             */
            tableParams.hasMultipleSelection = function() {
                return this.getMultipleSelection().length > 0;
            };

            tableParams.allItemSelected = false;

            /**
             * Checks if all items are selected.
             *
             * @param $event The event
             * @returns Condition
             */
            tableParams.updateAllItemSelected = function($event) {
                tableParams.allItemSelected = this.getMultipleSelection().length === this.data.length;
                $event.stopPropagation();
            };

            /**
             * Get the list of selected items.
             *
             * @returns The list of selected items
             */
            tableParams.getMultipleSelection = function() {
                return _.filter(this.data, function(e) {
                    return e.ngTableSelected;
                });
            };

            /**
             * Select / unselect all the items.
             *
             */
            tableParams.switchSelectAll = function() {
                if (!this.allItemSelected) {
                    this.unselectAll();
                } else {
                    this.selectAll();
                }
            };

            /**
             * Select all the items.
             *
             */
            tableParams.selectAll = function() {
                _.forEach(this.data, function(e) {
                    e.ngTableSelected = true;
                });
                this.allItemSelected = true;
            };

            /**
             * Unselect all the items.
             *
             */
            tableParams.unselectAll = function() {
                _.forEach(this.data, function(e) {
                    e.ngTableSelected = false;
                });
                this.allItemSelected = false;
            };

            /**
             * This action resets the current table to its initial parameters.
             */
            tableParams.initSorting = angular.copy(params.sorting);
            tableParams.reset = function() {
                this.filter({});
                this.page(1);
                this.count(10);
                this.sorting(tableParams.initSorting);
            };

            /**
             * Returns true if the table parameters are unchanged from the initial parameters.
             * @returns {boolean|Boolean}
             */
            tableParams.isInitParam = function() {
                var isFilterEmpty = function(filter) {
                    return _.every(filter, function(e) {
                        var t =
                            e == null ||
                            (typeof e == 'string' && e.trim() == '') ||
                            (typeof e == 'object');
                        return t;
                    });
                };
                return this.page() == 1 &&
                    this.count() == defaultCount &&
                    _.isEqual(this.sorting(), tableParams.initSorting) &&
                    isFilterEmpty(this.filter());
            };

            return tableParams;
        };

        /**
         * Construct the ng-table filter parameters.
         *
         * @param params ng-table params object
         */
        this.filter = function(params) {
            return _(params.filter())
                .pickBy(function(v) {
                    return typeof v != 'undefined' && (typeof v != 'object' || v instanceof Date || (v != null && v.ngTransformer == 'listItem')) &&
                        v != '';
                })
                .map(function(v, k) {
                    var value = v;
                    if (value instanceof Date) {
                        value = Form.formatDateTimeIso(value);
                    } else if (typeof value == 'object' && v.ngTransformer == 'listItem') {
                        value = value.id;
                    }
                    return k + "_" + value;
                })
                .value();
        };

        /**
         * Construct the paginated request parameters.
         *
         * @param params ng-table params object
         * @param addParam Additional request parameters
         */
        this.requestParam = function(params, addParam) {
            var param = {
                page: params.page(),
                count: params.count(),
                sort: params.orderBy(),
                filter: this.filter(params)
            };

            return addParam != null ? angular.extend(param, addParam) : param;
        };

        /**
         * Returns the sorting object from the URL parameters.
         *
         * @param orderBy URL parameters. Can be gotten from $location.search().orderBy
         * @param def Default parameters
         * @returns {*}
         */
        this.getSortingFromParam = function(orderBy, def) {
            var mapOrderBy = function(col) {
                return [col.substr(1), _(col).startsWith('+') ? 'asc' : 'desc'];
            };

            if (typeof(orderBy) == 'string') {
                return _([mapOrderBy(orderBy)]).object();
            } if (typeof(orderBy) == 'object') {
                return _(_(orderBy).map(mapOrderBy)).object();
            } else {
                return def;
            }
        };

        var getDataTableKey = function() {
            return 'ngTable' + $location.path();
        };

        /**
         * Return the data to save (in order to restore this search later) from the ng-table params.
         *
         * @param params Ng-table params
         * @returns {object} Data to save
         */
        var getSaveData = function(params) {
            return {
                page: params.page,
                count: params.count,
                sorting: params.sorting,
                filter: params.filter
            };
        };

        /**
         * Restore the search parameters saved in session storage.
         *
         * @returns {*}
         */
        this.restoreSearchData = function() {
            var params = JSON.parse(sessionStorage.getItem(getDataTableKey()));
            if (params != null) {
                return params.filter;
            } else {
                return {};
            }
        };

        this.resetData = function() {
            sessionStorage.removeItem(getDataTableKey());
        };

        this.saveData = function(params) {
            sessionStorage.setItem(getDataTableKey(), JSON.stringify(getSaveData(params)));
        };
        this.isShowSearch = function(searchData) {
            return !_.isEmpty(_.omitBy(searchData, _.isNil));
        }
    })
    .run(function($templateCache) {
        $templateCache.put('ng-table/pager.html', '<div class="ng-cloak ng-table-pager" ng-show="params.showPager()"><span>{{ "table_page_total" | translate : { total: params.total()} }} </span><div ng-if="params.settings().counts.length" class="ng-table-counts btn-group pull-right"> <button ng-repeat="count in params.settings().counts" type="button" ng-class="{\'active\':params.count()==count}" ng-click="params.count(count)" class="btn btn-default"> <span ng-bind="(count == params.settings().all ? params.settings().allLabel : count)"></span> </button> </div> <ul class="list-inline ng-table-pagination"> <li ng-class="{\'disabled\': !page.active && !page.current, \'active\': page.current}" ng-repeat="page in pages" ng-switch="page.type"> <a ng-switch-when="prev" ng-click="params.page(page.number)" href="">←</a> <a ng-switch-when="first" ng-click="params.page(page.number)" href=""><span ng-bind="page.number"></span></a> <a ng-switch-when="page" ng-click="params.page(page.number)" href=""><span ng-bind="page.number"></span></a> <a ng-switch-when="more" ng-click="params.page(page.number)" href="">&#8230;</a> <a ng-switch-when="last" ng-click="params.page(page.number)" href=""><span ng-bind="page.number"></span></a> <a ng-switch-when="next" ng-click="params.page(page.number)" href="">→</a> </li> </ul> </div> ');
        $templateCache.put('ng-table/filters/selectAllButtonFilter.html', '<input type="checkbox" name="selectAllFilter" ng-model="params.allItemSelected" ng-click="params.switchSelectAll()" class="btn-select-all"/>');
    });