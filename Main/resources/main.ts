/// <reference path="../libraries/definitions/d3.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />
/**
 * Global functionality used by the application
 */
namespace  MigrationVisualization {
    interface Organism {
        name: string;
        sex: string;
    }

//------------------------------------------------------------------------------
    export namespace Main {
        export let organisms: any = {};
        let calendar: CalendarMap;

        export function initialize() {
            var self = this;
            new Batch()
                .queue(function (next) {
                    $.ajax({
                        url: 'data/organisms.jsonp',
                        dataType: 'jsonp',
                        scriptCharset: 'utf-8',
                        crossDomain: true,
                        jsonpCallback: 'organisms',
                        success: function (data) {
                            organisms = data;
                            for (var id in organisms) {
                                if (organisms.hasOwnProperty(id)) {
                                    organisms[id].id = id;
                                }
                            }
                            next();
                        }
                    });
                })
                .queue(function (next) {
                    var ul = d3.select('#global-overview .gull-list'),
                        items = ul.selectAll('li')
                            .data(d3.values(organisms)),
                        li = items.enter().append('li')
                            .text(function (d: Organism) {
                                return d.name;
                            })
                            .attr('class', function (d: Organism) {
                                return d.sex;
                            })
                            .on('click', function (d: any) {
                                selectGulls([d.id]);
                            })
                        ;
                    next();
                })
                .queue(function (next) {
                    var slider = $('#schema-slider')
                            .attr('max', 99)
                            .val(78)
                            .on('change input', function () {
                                schematic.load(slider.val());
                            })
                        ;
                    schematic.select.on('select', function (e) {
                        selectNodes(e.target.getFeatures());
                    });
                    schematic.load(slider.val());
                    next();
                })
                .queue(function (next) {
                    var slider = $('#sat-slider-left')
                        .on('change input', function () {
                            var opacity = slider.val() / 100.0;
                            maps.layers.mapquestLeft.setVisible(opacity > 0);
                            maps.layers.mapquestLeft.setOpacity(opacity);
                        })
                        .val(0);

                    maps.layers.mapquestLeft.setOpacity(slider.val());
                    next();
                })
                .queue(function (next) {
                    var slider = $('#sat-slider-right')
                        .val(0)
                        .on('change input', function () {
                            var opacity = slider.val() / 100.0;
                            maps.layers.mapquestRight.setVisible(opacity > 0);
                            maps.layers.mapquestRight.setOpacity(opacity);
                        });

                    maps.layers.mapquestRight.setOpacity(slider.val());
                    next();
                })
                .queue(function (next) {
                    var slider = $('#heatmap-slider')
                            .val(100)
                            .on('change input', function () {
                                var opacity = slider.val() / 100.0;
                                heatmap.setOpacity(opacity);
                            })
                        ;
                    next();
                })
                .queue(function (next) {
                    var checkbox = $('#placenames-left')
                            .val(false)
                            .on('change input', function () {
                                maps.layers.topologyLeft.setVisible(self.checked);
                            })
                        ;
                    maps.layers.topologyLeft.setVisible(self.checked);
                    next();
                })
                .queue(function (next) {
                    var checkbox = $('#placenames-right')
                            .val(false)
                            .on('change input', function () {
                                maps.layers.topologyRight.setVisible(self.checked);
                            })
                        ;
                    maps.layers.topologyRight.setVisible(self.checked);
                    next();
                })
                .queue(function (next) {
                    calendar = new CalendarMap('calendar-map', [2013, 2015]);
                    next();
                })
                .go()
            ;
        }

//------------------------------------------------------------------------------
// Select schema nodes (takes map features)
// Note: this function is used by map interactions;
// this means that calling this function will not update the map itself.

        let selectNodes = function selectNodes(features) {
            if (!Array.isArray(features)) {
                features = features.getArray();
            }
            getNodeSelection = function () {
                return features.slice(0);
            };

            var gulls = new Intersection()
                    .addAll(features.map(function (d) {
                        return Object.keys(d.get('events'));
                    }))
                    .toArray();
            selectGulls(gulls);
        };

        let getNodeSelection = function () {
            return [];
        };

//------------------------------------------------------------------------------
// Select gulls by id (takes an array of ids)

        let selectGulls = function selectGulls(selected) {
            getGullSelection = function () {
                return selected.slice(0);
            };

            var hash = {};
            selected.forEach(function (d) {
                hash[d] = true;
            });
            inGullSelection = function (arr) {
                for (var i = arr.length - 1; i >= 0; --i)
                    if (arr[i] in hash)
                        return true;
                return false;
            };

            schematic.refresh();

            if (selected.length < 1) {
                // all is deselected
                $('#global-overview').show();
                $('#selection-overview').hide();
                journey.clear();
                heatmap.clear(); // clearing the heatmap shows the default one
            } else {
                $('#global-overview').hide();
                $('#selection-overview').show();

                if (selected.length == 1) {
                    journey.load(selected[0]);
                    // Heatmap of a single gull is not very useful, since the trajectory is shown.
                    heatmap.clear();
                } else {
                    journey.clear();
                    heatmap.load(selected);
                }
            }

            var nodes = getNodeSelection();
            if (!nodes.length)
                nodes = schematic.source.getFeatures()
                    .filter(function (d) {
                        return d.get('type') == 'node';
                    });
            calendar.load(nodes, selected);

            var list = d3.select('#gulls .gull-list').selectAll('li').data(selected);
            list.enter().append('li');
            list
                .text(function (d) {
                    return organisms[d].name;
                })
                .attr('class', function (d) {
                    return organisms[d].sex;
                })
                .on('click', function (d) {
                    selected.splice(selected.indexOf(d), 1);
                    selectGulls(selected);
                });
            list.exit().remove();
        };

        let getGullSelection = function () {
            return [];
        };

        export let inGullSelection: (arr: Array) => boolean = function () {
            return false;
        };

        export let intersectGullSelection = function intersectGullSelection(gulls) {
            selectGulls(new Intersection()
                .add(getGullSelection())
                .add(gulls)
                .toArray());
        };
    }

//------------------------------------------------------------------------------

    var Batch = function Batch() {
        this.list = [];
    };

    Batch.prototype.queue = function queue(func) {
        this.list.push(func);
        return this;
    };

    Batch.prototype.go = function go() {
        var self = this;

        function next() {
            var func = self.list.shift();
            if (func) {
                return func(next);
            }
        }

        next();
        return this;
    };

//------------------------------------------------------------------------------

    var Intersection = function Intersection() {
        var elements = undefined;

        var add = function add(arr) {
            if (elements) {
                elements = elements.filter(function (x) {
                    return arr.indexOf(x) >= 0;
                });
            } else {
                elements = arr.slice(0);
            }
            return this;
        };

        var addAll = function addAll(arrs) {
            for (var i = arrs.length - 1; i >= 0; --i)
                add(arrs[i]);
            return this;
        };

        var toArray = function toArray() {
            return (elements || []).slice(0);
        };

        this.add = add;
        this.addAll = addAll;
        this.toArray = toArray;
    };

//------------------------------------------------------------------------------

}

//------------------------------------------------------------------------------
