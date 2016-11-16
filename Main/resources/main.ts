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

    console.log("Start main file!");


    let main: any = {};
    console.log("Running main file!");

//------------------------------------------------------------------------------

    export function initialize() {
        var self = this;
        main.organisms = {};
        new Batch()
            .queue(function (next) {
                $.ajax({
                    url: 'data/organisms.jsonp',
                    dataType: 'jsonp',
                    scriptCharset: 'utf-8',
                    crossDomain: true,
                    jsonpCallback: 'organisms',
                    success: function (data) {
                        main.organisms = data;
                        for (var id in main.organisms) {
                            if (main.organisms.hasOwnProperty(id)) {
                                main.organisms[id].id = id;
                            }
                        }
                        next();
                    }
                });
            })
            .queue(function (next) {
                var ul = d3.select('#global-overview .gull-list'),
                    items = ul.selectAll('li')
                        .data(d3.values(main.organisms)),
                    li = items.enter().append('li')
                        .text(function (d: Organism) {
                            return d.name;
                        })
                        .attr('class', function (d: Organism) {
                            return d.sex;
                        })
                        .on('click', function (d: any) {
                            main.selectGulls([d.id]);
                        })
                    ;
                next();
            })
            .queue(function (next) {
                var slider = $('#schema-slider')
                        .attr('max', 99)
                        .val(78)
                        .on('change input', function () {
                            Schematic.main.load(slider.val());
                        })
                    ;
                Schematic.main.select.on('select', function (e) {
                    main.selectNodes(e.target.getFeatures());
                });
                Schematic.main.load(slider.val());
                next();
            })
            .queue(function (next) {
                var slider = $('#sat-slider-left')
                    .on('change input', function () {
                        var opacity = slider.val() / 100.0;
                        Maps.layers.mapquestLeft.setVisible(opacity > 0);
                        Maps.layers.mapquestLeft.setOpacity(opacity);
                    })
                    .val(0);

                Maps.layers.mapquestLeft.setOpacity(slider.val());
                next();
            })
            .queue(function (next) {
                var slider = $('#sat-slider-right')
                    .val(0)
                    .on('change input', function () {
                        var opacity = slider.val() / 100.0;
                        Maps.layers.mapquestRight.setVisible(opacity > 0);
                        Maps.layers.mapquestRight.setOpacity(opacity);
                    });

                Maps.layers.mapquestRight.setOpacity(slider.val());
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
                            Maps.layers.topologyLeft.setVisible(self.checked);
                        })
                    ;
                Maps.layers.topologyLeft.setVisible(self.checked);
                next();
            })
            .queue(function (next) {
                var checkbox = $('#placenames-right')
                        .val(false)
                        .on('change input', function () {
                            Maps.layers.topologyRight.setVisible(self.checked);
                        })
                    ;
                Maps.layers.topologyRight.setVisible(self.checked);
                next();
            })
            .queue(function (next) {
                main.calendar = new Calendarmap('calendar-map', [2013, 2015]);
                next();
            })
            .go()
        ;
    };

//------------------------------------------------------------------------------
// Select schema nodes (takes map features)
// Note: this function is used by map interactions;
// this means that calling this function will not update the map itself.

    main.selectNodes = function selectNodes(features) {
        if (!Array.isArray(features)) {
            features = features.getArray();
        }
        main.getNodeSelection = function () {
            return features.slice(0);
        };

        var gulls = new Intersection()
                .addAll(features.map(function (d) {
                    return Object.keys(d.get('events'));
                }))
                .toArray()
            ;
        main.selectGulls(gulls);
    };

    main.getNodeSelection = function () {
        return [];
    };

//------------------------------------------------------------------------------
// Select gulls by id (takes an array of ids)

    main.selectGulls = function selectGulls(selected) {
        main.getGullSelection = function () {
            return selected.slice(0);
        };

        var hash = {};
        selected.forEach(function (d) {
            hash[d] = true;
        });
        main.inGullSelection = function (arr) {
            for (var i = arr.length - 1; i >= 0; --i)
                if (arr[i] in hash)
                    return true;
            return false;
        };

        Schematic.main.refresh();

        if (selected.length < 1) {
            // all is deselected
            $('#global-overview').show();
            $('#selection-overview').hide();
            Journey.main.clear();
            heatmap.clear(); // clearing the heatmap shows the default one
        } else {
            $('#global-overview').hide();
            $('#selection-overview').show();

            if (selected.length == 1) {
                Journey.main.load(selected[0]);
                // Heatmap of a single gull is not very useful, since the trajectory is shown.
                heatmap.clear();
            } else {
                Journey.main.clear();
                heatmap.load(selected);
            }
        }

        var nodes = main.getNodeSelection();
        if (!nodes.length)
            nodes = Schematic.main.source.getFeatures()
                .filter(function (d) {
                    return d.get('type') == 'node';
                });
        main.calendar.load(nodes, selected);

        var list = d3.select('#gulls .gull-list').selectAll('li').data(selected);
        list.enter().append('li');
        list
            .text(function (d) {
                return main.organisms[d].name;
            })
            .attr('class', function (d) {
                return main.organisms[d].sex;
            })
            .on('click', function (d) {
                selected.splice(selected.indexOf(d), 1);
                selectGulls(selected);
            });
        list.exit().remove();
    };

    main.getGullSelection = function () {
        return [];
    };

    main.inGullSelection = function () {
        return false;
    };

    main.intersectGullSelection = function intersectGullSelection(gulls) {
        main.selectGulls(new Intersection()
            .add(main.getGullSelection())
            .add(gulls)
            .toArray());
    };

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
