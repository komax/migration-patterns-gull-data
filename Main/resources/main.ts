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
                    // console.log(d.getKeys());
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


        /**
         * Enum to group and select genders.
         */
        enum Gender {
            Male,
            Female,
            All
        }

        /**
         * Compute statistics for the tooltip at a specific stopover.
         */
        class StopoverStatistics {
            private stopoverFeature: ol.Feature;

            constructor(selectEvent: ol.interaction.SelectEvent) {
                if (selectEvent.selected.length !== 1) {
                    throw new Error('Computing statistics only on one stopover');
                }

                this.stopoverFeature = selectEvent.selected[0];

            }

            private filterOrganismPerGender(ids, gender: Gender): string[] {
                switch (gender) {
                    case Gender.All:
                        return ids;
                    case Gender.Female:
                        return ids.filter((id) => {
                            return organisms[id].sex === 'female';
                        });
                    case Gender.Male:
                        return ids.filter((id) => {
                            return organisms[id].sex === 'male';
                        });
                }
            }

            static totalNumberOfOrganisms(): number {
                let ids = Object.keys(organisms);
                return ids.length;
            }

            numberOfOrganisms(): number {
                let events = this.stopoverFeature.get('events');
                if (events === undefined || events === null) {
                    return 0;
                } else {
                    const ids: string[] = Object.keys(events);
                    return ids.length;
                }
            }

            femaleOrganisms(): string[] {
                let events = this.stopoverFeature.get('events');
                if (events === undefined || events === null) {
                    return [];
                } else {
                    const ids: string[] = Object.keys(events);
                    return this.filterOrganismPerGender(ids, Gender.Female);
                }
            }

            maleOrganisms(): string[] {
                let events = this.stopoverFeature.get('events');
                if (events === undefined || events === null) {
                    return [];
                } else {
                    const ids: string[] = Object.keys(events);
                    return this.filterOrganismPerGender(ids, Gender.Male);
                }
            }
        }

        /**
         * Visualize some statistics as tooltip on each stopover.
         * @param selectEvent Current selection event from openlayers.
         */
        const visualizeToolTipStatistics = (selectEvent: ol.interaction.SelectEvent) => {
            if (selectEvent.selected.length === 1) {
                let stat = new StopoverStatistics(selectEvent);
                console.log(stat.femaleOrganisms());
                console.log(stat.maleOrganisms());
                console.log(stat.numberOfOrganisms());
                console.log(StopoverStatistics.totalNumberOfOrganisms());
                let feature: ol.Feature = selectEvent.selected[0];
                let geometry = feature.getGeometry();
                console.log(geometry);
                let extent = geometry.getExtent();
                let center = ol.extent.getCenter(extent);
                console.log("The center is "+ center);
            }
        };

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
                    schematic.stopoverSelect.on('select', (selectEvent: ol.interaction.SelectEvent) => {
                        stopOverSeq.update(selectEvent);
                        selectGulls(stopOverSeq.intersection());
                    });
                    schematic.statisticsSelect.on('select', (selectEvent: ol.interaction.SelectEvent) => {
                        visualizeToolTipStatistics(selectEvent);
                    });
                    schematic.load(slider.val());
                    next();
                })
                .queue((next) => {
                    let slider = $('#sat-slider-left')
                        .on('change input', () => {
                            let opacity = slider.val() / 100.0;
                            maps.layers.satelliteLeft.setVisible(opacity > 0);
                            maps.layers.satelliteLeft.setOpacity(opacity);
                        })
                        .val(0);

                    maps.layers.satelliteLeft.setOpacity(slider.val());
                    next();
                })
                .queue((next) => {
                    let slider = $('#sat-slider-right')
                        .val(0)
                        .on('change input', () => {
                            let opacity = slider.val() / 100.0;
                            maps.layers.satelliteRight.setVisible(opacity > 0);
                            maps.layers.satelliteRight.setOpacity(opacity);
                        });

                    maps.layers.satelliteRight.setOpacity(slider.val());
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
