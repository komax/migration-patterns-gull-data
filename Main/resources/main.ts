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
        import Feature = ol.Feature;
        import Collection = ol.Collection;

        export let organisms: any = {};
        let calendar: CalendarMap;

        export function initialize() {
            new Batch()
                .queue((next) => {
                    $.ajax({
                        url: 'data/organisms.jsonp',
                        dataType: 'jsonp',
                        scriptCharset: 'utf-8',
                        crossDomain: true,
                        jsonpCallback: 'organisms',
                        success: (data) => {
                            organisms = data;
                            for (let id in organisms) {
                                if (organisms.hasOwnProperty(id)) {
                                    organisms[id].id = id;
                                }
                            }
                            next();
                        }
                    });
                })
                .queue((next) => {
                    let ul = d3.select('#global-overview .gull-list'),
                        items = ul.selectAll('li')
                            .data(d3.values(organisms)),
                        li = items.enter().append('li')
                            .text((d: Organism) => {
                                return d.name;
                            })
                            .attr('class', (d: Organism) => {
                                return d.sex;
                            })
                            .on('click', (d: any) => {
                                selectGulls([d.id]);
                            })
                        ;
                    next();
                })
                .queue((next) => {
                    let slider = $('#schema-slider')
                            .attr('max', 99)
                            .val(78)
                            .on('change input', () => {
                                schematic.load(slider.val());
                            })
                        ;
                    schematic.select.on('select', (e: ol.interaction.SelectEvent) => {
                        console.log("Select Event: target");
                        console.log(e.target);
                        console.log("Selected");
                        for (let selected of e.selected) {
                            console.log(selected);
                        }
                        console.log("Deselected");
                        for (let deselected of e.deselected) {
                            console.log(deselected);
                        }
                        let select: ol.interaction.Select = e.target as ol.interaction.Select;
                        selectNodes(select.getFeatures());
                    });
                    schematic.load(slider.val());
                    next();
                })
                .queue((next) => {
                    let slider = $('#sat-slider-left')
                        .on('change input', () => {
                            let opacity = slider.val() / 100.0;
                            maps.layers.mapquestLeft.setVisible(opacity > 0);
                            maps.layers.mapquestLeft.setOpacity(opacity);
                        })
                        .val(0);

                    maps.layers.mapquestLeft.setOpacity(slider.val());
                    next();
                })
                .queue((next) => {
                    let slider = $('#sat-slider-right')
                        .val(0)
                        .on('change input', () => {
                            let opacity = slider.val() / 100.0;
                            maps.layers.mapquestRight.setVisible(opacity > 0);
                            maps.layers.mapquestRight.setOpacity(opacity);
                        });

                    maps.layers.mapquestRight.setOpacity(slider.val());
                    next();
                })
                .queue((next) => {
                    let slider = $('#heatmap-slider')
                            .val(100)
                            .on('change input', () => {
                                let opacity = slider.val() / 100.0;
                                heatmap.setOpacity(opacity);
                            })
                        ;
                    next();
                })
                .queue((next) => {
                    let checkbox = $('#placenames-left')
                            .val(0)
                            .on('change input', () => {
                                maps.layers.topologyLeft.setVisible(this.checked);
                            })
                        ;
                    maps.layers.topologyLeft.setVisible(this.checked);
                    next();
                })
                .queue((next) => {
                    let checkbox = $('#placenames-right')
                            .val(0)
                            .on('change input', () => {
                                maps.layers.topologyRight.setVisible(this.checked);
                            })
                        ;
                    maps.layers.topologyRight.setVisible(this.checked);
                    next();
                })
                .queue((next) => {
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

        let selectNodes: (features: ol.Collection<ol.Feature> | Array<Feature>) => void = function selectNodes(features) {
            console.log("Within selectNodes");
            console.log(features);
            if (!Array.isArray(features)) {
                features = features.getArray();
            }
            getNodeSelection = function () {
                if (!Array.isArray(features)) {
                    return features.getArray().slice(0);
                } else {
                    return features.slice(0);
                }
            };

            // Gull ids per stop as an Array.
            let stops: Array<Array<string>> = features.map((d: Feature) => {

                console.log(d.getKeys());
                console.log(d.get('radii'));
                console.log(d.get('type'));
                console.log(d.get('events'));
                return Object.keys(d.get('events'));
            });
            console.log(stops);
            let gulls = new Intersection()
                    .addAll(stops)
                    .toArray();
            console.log(gulls);
            selectGulls(gulls);
        };

        let getNodeSelection: () => Feature[];

//------------------------------------------------------------------------------
// Select gulls by id (takes an array of ids)

        let selectGulls: (selected: string[]) => void = function selectGulls(selected: string[]) {
            console.log(selected);
            getGullSelection = function (): string[] {
                return selected.slice(0);
            };

            let hash = {};
            selected.forEach(function (d) {
                hash[d] = true;
            });
            inGullSelection = function (arr) {
                for (let i = arr.length - 1; i >= 0; --i)
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

            let nodes: Feature[] = getNodeSelection();
            if (!nodes.length) {
                let features: Feature[] = schematic.source.getFeatures();
                nodes = features.filter(function (d) {
                        return d.get('type') == 'node';
                    });
            }
            calendar.load(nodes, selected);

            let list = d3.select('#gulls .gull-list').selectAll('li').data(selected);
            list.enter().append('li');
            list
                .text(function (d: string) {
                    return organisms[d].name;
                })
                .attr('class', function (d: string) {
                    return organisms[d].sex;
                })
                .on('click', function (d) {
                    selected.splice(selected.indexOf(d), 1);
                    selectGulls(selected);
                });
            list.exit().remove();
        };

        let getGullSelection: () => string[] = function () {
            return [];
        };

        export let inGullSelection: (arr: Array<string>) => boolean = function () {
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

    class Batch {
        private list: Array<Function>;

        constructor() {
            this.list = [];
        }

        queue(func) {
            this.list.push(func);
            return this;
        }

        go() {
            let next = () => {
                let func = this.list.shift();
                if (func) {
                    return func(next);
                }
            };

            next();
            return this;
        }
    }

    class Intersection {
        private elements;

        constructor() {
            this.elements = undefined;
        }

        add(arr: string[]): Intersection {
            if (this.elements) {
                this.elements = this.elements.filter((x) => {
                    return arr.indexOf(x) >= 0;
                });
            } else {
                this.elements = arr.slice(0);
            }
            return this;
        }

        addAll(arrs: Array<Array<string>>): Intersection {
            for (let i = arrs.length - 1; i >= 0; --i) {
                this.add(arrs[i]);
            }
            return this;
        }

        toArray(): string[] {
            return (this.elements || []).slice(0);
        }
    }

}

