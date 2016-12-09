/// <reference path="../libraries/definitions/d3.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />
/**
 * Global functionality used by the application
 */
namespace  MigrationVisualization {
    import Feature = ol.Feature;
    import Collection = ol.Collection;

    interface Organism {
        name: string;
        sex: string;
        id: string;
    }

//------------------------------------------------------------------------------
    export namespace Main {
        export let organisms: any = {};
        let calendar: CalendarMap;
        /**
         * Maintaining the selection and deselection of nodes within the schematic map.
         */
        class StopoverSequence {
            private nodes: ol.Feature[];
            private sortBy: (id1: string, id2: string) => number;

            constructor() {
                this.nodes = [];
                this.sortBy = (id1: string, id2: string) => {
                    let o1 = organisms[id1];
                    let o2 = organisms[id2];
                    if (o1.name < o2.name) {
                        return -1;
                    } else if (o1.name > o2.name) {
                        return 1;
                    } else {
                        return 0;
                    }};
            }

            update(selectEvent: ol.interaction.SelectEvent): void {
                // Add the new selected ones to the selection.
                this.nodes = this.nodes.concat(selectEvent.selected);
                // Remove the deselected ones.
                let deselected = selectEvent.deselected;
                this.nodes = this.nodes.filter((elem) => {
                    // Keep only the ones that are still selected (not deselected).
                    return deselected.indexOf(elem) === -1;
                });
            }

            idsPerStopover(): Array<Array<string>> {
                // Gull ids per stop as an Array.
                return this.nodes.map((d: Feature) => {
                    console.log(d.getKeys());
                    // console.log(d.get('type'));
                    // console.log(d.get('events'));
                    return Object.keys(d.get('events'));
                });
            }

            idsAllStops(): Array<string> {
                // Flatten array of the ids.
                const ids = [].concat.apply([], this.idsPerStopover());
                // Sort them alphabetically.
                ids.sort(this.sortBy);
                return ids;
            }

            intersection(): Array<string> {
                // Compute first the intersection for all ids per stopover.
                const intersect = new Intersection();
                intersect.addAll(this.idsPerStopover());
                const ids = intersect.toArray();
                // Sort them alphabetically.
                ids.sort(this.sortBy);
                return ids;
            }

            selectDuration(startDate: Date, endDate: Date): void {
                // TODO Implement this method.
            }

            // TODO Add more features.
        }
        const stopOverSeq: StopoverSequence = new StopoverSequence();

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
                    let organisms_array = d3.values(organisms);
                    // Sort the organisms based on their name.
                    organisms_array.sort(
                        (o1: Organism, o2: Organism) => {
                            if (o1.name < o2.name) {
                                return -1;
                            } else if (o1.name > o2.name) {
                                return 1;
                            } else {
                                return 0;
                            }
                        }
                    );
                    let ul = d3.select('#global-overview .gull-list'),
                        items = ul.selectAll('li')
                            .data(organisms_array),
                        li = items.enter().append('li')
                            .text((organism: Organism) => {
                                return organism.name;
                            })
                            .attr('class', (organism: Organism) => {
                                return organism.sex;
                            })
                            .on('click', (organsim: Organism) => {
                                selectGulls([organsim.id]);
                            })
                            .on('mouseover', (organism: Organism) => {
                                journey.load(organism.id);
                            });
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
                    schematic.select.on('select', (selectEvent: ol.interaction.SelectEvent) => {
                        stopOverSeq.update(selectEvent);
                        selectGulls(stopOverSeq.intersection());
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

        let getNodeSelection: () => Feature[] = () => {
            return [];
        };

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

        export let intersectGullSelection = function intersectGullSelection(gullIds: string[]) {
            console.log("Within intersectGullSelection");
            console.log(gullIds);
            selectGulls(new Intersection()
                .add(getGullSelection())
                .add(gullIds)
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
