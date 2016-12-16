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

    export interface Stopover {
        [id: string]: Array<number>;
    }

//------------------------------------------------------------------------------
    export namespace Main {
        export let organisms: any = {};

        /**
         * Sort the organism ids alphabetically based on their names. (Sorted in-place)
         * @param ids array of organism's identifiers
         */
        function sortOrganismsIds(ids: string[]): void {
            const sortBy = (id1: string, id2: string) => {
                let o1 = organisms[id1];
                let o2 = organisms[id2];
                if (o1.name < o2.name) {
                    return -1;
                } else if (o1.name > o2.name) {
                    return 1;
                } else {
                    return 0;
                }
            };
            ids.sort(sortBy);
        }

        let calendar: CalendarMap;
        /**
         * Maintaining the selection and deselection of nodes within the schematic map.
         */
        class StopoverSequence {
            private nodes: ol.Feature[];
            private hasChanged: boolean;
            private result: any;

            constructor() {
                this.nodes = [];
                this.hasChanged = false;
            }

            update(selectEvent: ol.interaction.SelectEvent): void {
                // Set the changed flag.
                this.hasChanged = true;
                // Add the new selected ones to the selection.
                this.nodes = this.nodes.concat(selectEvent.selected);
                // Remove the deselected ones.
                let deselected = selectEvent.deselected;
                // And remove their selectionNumber.
                for (let feature of deselected) {
                    feature.unset("selectionNumber");
                }
                this.nodes = this.nodes.filter((elem) => {
                    // Keep only the ones that are still selected (not deselected).
                    return deselected.indexOf(elem) === -1;
                });
                this.nodes.forEach((feature, i, nodes) => {
                    // Set for each selected feature its index starting from 1.
                    feature.set('selectionNumber', i + 1);
                });
            }

            idsPerStopover(): Array<Array<string>> {
                // Gull ids per stop as an Array.
                return this.nodes.map((d: Feature) => {
                    // console.log(d.getKeys());
                    // console.log(d.get('type'));
                    console.log(d.get('events'));
                    return Object.keys(d.get('events'));
                });
            }

            idsAllStops(): Array<string> {
                // Flatten array of the ids.
                const ids = [].concat.apply([], this.idsPerStopover());
                // Sort them alphabetically.
                sortOrganismsIds(ids);
                return ids;
            }

            intersection(): Array<string> {
                if (this.hasChanged) {
                    // Compute first the intersection for all ids per stopover.
                    const intersect = new Intersection();
                    intersect.addAll(this.idsPerStopover());
                    const ids = intersect.toArray();
                    // Sort them alphabetically.
                    sortOrganismsIds(ids);
                    this.result = ids;
                }
                return this.result;
            }

            getSelection(): string[] {
                if (!this.hasChanged) {
                    // Reuse the cached result if not changed.
                    return this.result;
                } else {
                    // Compute the selection first.


                    return this.result;
                }
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

            renderSVGTooltip(tooltipID: string): string {
                // Obtain the statistical values.
                let numberMales = this.maleOrganisms().length;
                let numberFemales = this.femaleOrganisms().length;
                let organismsAtStopover = numberFemales + numberMales;
                let organismsNotAtStopover = StopoverStatistics.totalNumberOfOrganisms() - organismsAtStopover;

                let palette = ["#d73027", "#4575b4", "#969696"];

                const data: any[] = [];
                let offset = 0;
                for (let val of [numberFemales, numberMales, organismsNotAtStopover]) {
                    data.push({x: offset, w: val});
                    offset += val;
                }

                const height = 40;
                const width = 400;

                const margin = {top: 2, right: 2, bottom: 2, left: 2},
                    innerWidth = width - margin.left - margin.right,
                    innerHeight = height - margin.top - margin.bottom;

                // Create a temporary svg element on the tooltip.
                let svg = d3.select(tooltipID).append("svg")
                    .attr("width", innerWidth + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .append("g")
                    .attr("transform", `translate(${margin.left}, ${margin.top})`);

                // Set up the scale to map number of organisms to innerWidth.
                let x = d3.scale.linear()
                    .rangeRound([0, innerWidth])
                    .domain([0, StopoverStatistics.totalNumberOfOrganisms()]);

                // Enter the data with the corresponding color.
                svg.selectAll("rect")
                    .data(data)
                    .enter()
                    .append("rect")
                    .attr("width", (d) => {
                        return x(d.w);
                    })
                    .attr("height", innerHeight)
                    .attr("x", (d) => {
                        return x(d.x);
                    })
                    .attr("y", margin.top)
                    .style("fill", (d, i) => {
                        return palette[i];
                    });

                // Add text labels to the columns.
                svg.selectAll("text")
                    .data(data)
                    .enter()
                    .append("text")
                    .text((d) => {
                        if (d.w > 0) {
                            return d.w;
                        } else {
                            return "";
                        }
                    })
                    .attr("x", (d) => {
                        return x(d.w / 2 + d.x);
                    })
                    .attr("y", margin.top + innerHeight / 2)
                    .attr("font-size", 20)
                    .style("text-anchor", "middle")
                    .style("alignment-baseline", "middle")
                    .style("fill", "#ffffff")
                    .style("stroke", "#000000")
                    .style("stroke-width", 1)
                    .style("font-weight", "bold");

                // Generate the html code for the tooltip.
                let svgString: string = $(`${tooltipID}`).html();

                // Remove the temporary svg element.
                d3.select(`${tooltipID} svg`).remove();
                return svgString;
            }
        }

        /**
         * Visualize some statistics as tooltip on each stopover.
         * @param selectEvent Current selection event from openlayers.
         */
        const visualizeToolTipStatistics = (selectEvent: ol.interaction.SelectEvent) => {
            if (selectEvent.selected.length === 1) {
                let stat = new StopoverStatistics(selectEvent);

                // Get the center of the node.
                let feature: ol.Feature = selectEvent.selected[0];
                let geometry = feature.getGeometry();
                let extent = geometry.getExtent();
                let center = ol.extent.getCenter(extent);
                // Update the overlay's position to the center.
                schematic.stopoverStatisticsPopover.setPosition(center);

                // Update the content of the tooltip and show it.
                let statPopup = $('#stopover-statistics');
                statPopup.tooltipster('content', stat.renderSVGTooltip('#stopover-statistics'));
                statPopup.tooltipster('show');
            } else {
                // Hide it if we deselected a node.
                $('#stopover-statistics').tooltipster('hide');
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
                            })
                            .on('mouseout', (organism: Organism) => {
                                journey.clear();
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
                // .queue((next) => {
                //     // let checkbox = $('#placenames-left')
                //     //         .val(0)
                //     //         .on('change input', () => {
                //     //             maps.layers.topologyLeft.setVisible(this.checked);
                //     //         })
                //     //     ;
                //     // maps.layers.topologyLeft.setVisible(this.checked);
                //     next();
                // })
                // .queue((next) => {
                //     // let checkbox = $('#placenames-right')
                //     //         .val(0)
                //     //         .on('change input', () => {
                //     //             maps.layers.topologyRight.setVisible(this.checked);
                //     //         })
                //     //     ;
                //     // maps.layers.topologyRight.setVisible(this.checked);
                //     next();
                // })
                .queue((next) => {
                    calendar = new CalendarMap('calendar-map', [2013, 2015]);
                    next();
                })
                .go()
            ;
        }

//------------------------------------------------------------------------------
// Select gulls by id (takes an array of ids)

        function selectGulls(selected: string[]): void {
            console.log(selected);
            gullSelection = selected;

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

            calendar.load(schematic.getNodes(), selected);

            let newSelection: string[] = [];
            let list = d3.select('#gulls .gull-list').selectAll('li').data(selected);
            list.enter().append('li');
            list
                .text(function (d: string) {
                    return organisms[d].name;
                })
                .attr('class', function (d: string) {
                    return organisms[d].sex;
                })
                .on('mouseover', (id: string) => {
                    journey.load(id);
                })
                .on('mouseout', (id: string) => {
                    journey.clear();
                })
                .on('click', function (id: string) {
                    const event: MouseEvent = <MouseEvent>d3.event;
                    // Cover multiple selections using Crtl+click.
                    if (event.ctrlKey) {
                        const s = d3.select(this);
                        if (s.classed('selected')) {
                            // Deselection case. Style it as not selected.
                            s.classed('selected', false);
                            // Removing the id from the newSelection.
                            newSelection.splice(newSelection.indexOf(id), 1);
                        } else {
                            // Selection case. Style it accordingly.
                            s.classed('selected', true);
                            // Add this entity to the selection.
                            newSelection.push(id);
                        }
                    } else {
                        // Finalize the selection if not a Ctrl key has been pushed (or released).
                        if (newSelection.length === 0) {
                            // If not a single entity has been selected, just select one.
                            selectGulls([id]);
                        } else {
                            // Select eventually those entities.
                            sortOrganismsIds(newSelection);
                            selectGulls(newSelection);
                        }
                        // Allow a new selection.
                        newSelection = [];
                    }
                })
                .on('dblclick', function(id: string) {
                    // Return to the gull list by double clicking.
                    selectGulls([]);
                });
            list.exit().remove();
        }

        let gullSelection: string[] = [];

        export let inGullSelection: (organismsIds: Array<string>) => boolean = function (organismsIds) {
            for (let id of organismsIds) {
                if (gullSelection.indexOf(id) !== -1) {
                    return true;
                }
            }
            return false;
        };

        export let intersectGullSelection = function intersectGullSelection(gullIds: string[]) {
            selectGulls(new Intersection()
                .add(gullSelection)
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
