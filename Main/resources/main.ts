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

    // Type for a duration [from, to].
    type DurationRange = [Date, Date];

    export interface Stopover {
        [id: string]: number[];
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

        /**
         * An Iterator for a DurationRange.
         */
        class DurationRangeIterator {
            private current: DurationRange;
            private currentIndex: number;

            constructor(private list: number[]) {
                this.currentIndex = 0;
            }

            hasNext(): boolean {
                if (this.list === undefined) {
                    return false;
                } else {
                    return this.currentIndex <= (this.list.length - 1);
                }
            }

            next(): DurationRange {
                if (this.hasNext()) {
                    const elems = <[number, number]>this.list.slice(this.currentIndex,
                        this.currentIndex + 2);
                    this.current = <DurationRange>elems.map((n) => {
                        return new Date(n);
                    });
                    this.currentIndex += 2;
                    return this.current;
                } else {
                    throw new Error("The list has been exhausted. It cannot be iterated anymore.");
                }
            }

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

            /**
             * Process the selectEvent from the aggregation in openlayers.
             * @param selectEvent: Selection event from open layers that will be processed.
             */
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

            /**
             * @deprecated use getSelection instead.
             * @returns {any}
             */
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

            /**
             * Compute what organims are visiting the the current selection from origin to its destination by
             * having at least one duration that visits the sequence as OD pair.
             * @param gender Restrict the selection to a certain gender. Default all genders.
             * @returns {string[]} an array of organisms' ids visiting the nodes in a sequential order.
             */
            getSelection(gender: Gender = Gender.All): string[] {
                if (this.hasChanged) {
                    // If nothing is selected, return an empty object.
                    if (this.nodes.length === 0) {
                        this.result = {};
                    } else {
                        // Compute the selection first.
                        const events: Stopover = this.nodes[0].get('events');
                        // Start with the events from the first stopover by copying the stopover vals.
                        this.result = jQuery.extend(true, {}, events);

                        for (let i = 0; i < this.nodes.length - 1; i++) {
                            const currentStopover: Stopover = this.nodes[i].get('events');
                            const nextStopover: Stopover = this.nodes[i + 1].get('events');

                            const idsCurrentStop = Object.keys(currentStopover);
                            const idsNextStop = Object.keys(nextStopover);

                            // Remove ids which do not occur in the selected stopovers.
                            for (const id of Object.keys(this.result)) {
                                if (idsCurrentStop.indexOf(id) === -1) {
                                    delete  this.result[id];
                                } else if (idsNextStop.indexOf(id) === -1) {
                                    delete this.result[id];
                                }
                            }

                            for (const idCurrentStop of idsCurrentStop) {
                                // Store information whether a duration has a successor.
                                const successorList: boolean[] = [];
                                // Iterator of the stops at currentStop.
                                const iterCurrentStop = new DurationRangeIterator(currentStopover[idCurrentStop]);
                                while (iterCurrentStop.hasNext()) {
                                    const [startCurrentStopover, endCurrentStopover] = iterCurrentStop.next();

                                    const iterNextStop = new DurationRangeIterator(nextStopover[idCurrentStop]);
                                    while (iterNextStop.hasNext()) {
                                        const [startNextStopover, endNextStopover] = iterNextStop.next();
                                        let hasSuccessor = false;
                                        const diff = +startNextStopover - +endCurrentStopover;
                                        if (diff > 0) {
                                            hasSuccessor = true;
                                        }
                                        successorList.push(hasSuccessor);
                                    }
                                    if (!successorList.some((b) => {
                                            return b;
                                        })) {
                                        // If there is not at least one successor, remove the id;
                                        delete this.result[idCurrentStop];
                                    }
                                }
                            }
                        }
                    }
                }
                let ids = Object.keys(this.result);
                // Filter those ids of the selected gender.
                ids = filterOrganismPerGender(ids, gender);

                // Sort the ids based on their names.
                sortOrganismsIds(ids);
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
            All,
            Female,
            Male
        }

        function filterOrganismPerGender(ids, gender: Gender): string[] {
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

        /**
         * Trigger a selection of organisms based on their gender.
         * @param val : "All", "Females" or "Males" as values from the hmtl select.
         */
        function doSelectOrganims(val: string): void {
            switch(val) {
                case "All":
                    return selectGulls(stopOverSeq.getSelection(Gender.All));
                case "Females":
                    return selectGulls(stopOverSeq.getSelection(Gender.Female));
                case "Males":
                    return selectGulls(stopOverSeq.getSelection(Gender.Male));
            }
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
                    return filterOrganismPerGender(ids, Gender.Female);
                }
            }

            maleOrganisms(): string[] {
                let events = this.stopoverFeature.get('events');
                if (events === undefined || events === null) {
                    return [];
                } else {
                    const ids: string[] = Object.keys(events);
                    return filterOrganismPerGender(ids, Gender.Male);
                }
            }

            /**
             * Generate a svg for the gender distribution on
             * @param tooltipID html element on which the svg will be generated temporarily and deleted after that
             * @returns {string} the complete svg element as a string.
             */
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

        /**
         * Add the legend for the genders to all .gender-legend classes as svg element.
         */
        function showGenderLegend(): void {
            const palette = ["#d73027", "#4575b4"]; // [ female, male ]

            const data: any[] = [];
            let offset = 0;
            const rectWidth = 50;

            for (let i = 0; i < palette.length; i++) {
                data.push({x: offset, w: rectWidth});
                offset += rectWidth;
            }


            const height = 50, width = 250;
            const margin = {top: 0, right: 0, bottom: 0, left: 25},
                innerWidth = width - margin.left - margin.right,
                innerHeight = height - margin.top - margin.bottom;

            // Create the svg element.
            const svg = d3.selectAll(".gender-legend").append("svg")
                .attr("width", innerWidth + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${margin.left}, ${margin.top})`);


            // Set up the scale to correspond to the rectWidths.
            const x = d3.scale.linear()
                .rangeRound([0, innerWidth])
                .domain([0, palette.length * rectWidth - 1]);

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
                .text((d, i) => {
                    if (i === 0) {
                        return "Female";
                    } else if (i === palette.length - 1) {
                        return "Male";
                    } else {
                        return "";
                    }
                })
                .attr("x", (d, i) => {
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
        }

        /**
         * Show all organisms as a list and add user interactions with mouse and keys to it.
         * @param organisms_array an array of organisms that needs to be added.
         */
        function showGullList(organisms_array: Organism[]): void {
            const ul = d3.select('#global-overview .gull-list');
            ul.html("");

            let newSelection: string[] = [];

            const items = ul.selectAll('li')
                    .data(organisms_array),
                li = items.enter().append('li')
                    .text((organism: Organism) => {
                        return organism.name;
                    })
                    .attr('class', (organism: Organism) => {
                        return organism.sex;
                    })
                    .on('click', function (organism: Organism) {
                        const event: MouseEvent = <MouseEvent>d3.event;
                        // Cover multiple selections using Crtl+click.
                        if (event.ctrlKey) {
                            const s = d3.select(this);
                            if (s.classed('selected')) {
                                // Deselection case. Style it as not selected.
                                s.classed('selected', false);
                                // Removing the id from the newSelection.
                                newSelection.splice(newSelection.indexOf(organism.id), 1);
                            } else {
                                // Selection case. Style it accordingly.
                                s.classed('selected', true);
                                // Add this entity to the selection.
                                newSelection.push(organism.id);
                            }
                        } else {
                            // Finalize the selection if not a Ctrl key has been pushed (or released).
                            if (newSelection.length === 0) {
                                // If not a single entity has been selected, just select one.
                                selectGulls([organism.id]);
                            } else {
                                // Select eventually those entities.
                                sortOrganismsIds(newSelection);
                                selectGulls(newSelection);
                            }
                            // remove the selection class from the list either way.
                            items.classed('selected', false);

                            // Allow a new selection.
                            newSelection = [];
                        }
                    })
                    .on('mouseover', (organism: Organism) => {
                        journey.load(organism.id);
                    })
                    .on('mouseout', (organism: Organism) => {
                        journey.clear();
                    });

            d3.select("body").on('keydown', () => {
                // if ESC key is pressed.
                if ((d3.event as any).keyCode === 27) {
                    // release the selection.
                    newSelection = [];
                    // remove the selection class from the list as well.
                    items.classed('selected', false);
                }
            });
        }

        /**
         * Prepare the list of gulls on a subselection of genders and visualize those gulls at a heatmap.
         * @param gender selection of gender: male, female or all. Default is all.
         */
        function renderGullList(gender: Gender = Gender.All): void {
            let organisms_array: Organism[] = d3.values<Organism>(organisms);

            switch (gender) {
                case Gender.All:
                    // Nothing to do.
                    break;
                case Gender.Female:
                    // Filter the female organisms.
                    organisms_array = organisms_array.filter((organism: Organism) => {
                        return organism.sex === 'female';
                    });
                    break;
                case Gender.Male:
                    // Filter the male organisms.
                    organisms_array = organisms_array.filter((organism: Organism) => {
                        return organism.sex === 'male';
                    });
                    break;
            }

            // Update the heat map with the subset of ids.
            const ids = organisms_array.map((organism: Organism) => {
                return organism.id;
            });

            // Show those ids as a heatmap.
            if (ids.length > 0) {
                journey.clear();
                heatmap.load(ids);
            }

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
            showGullList(organisms_array);
        }

        /**
         * Initialize the whole UI as a batch process.
         */
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
                    // User interaction: Depending on the new choice rerender the gull list.
                    $('#genders-all').on('change', function () {
                        switch (this.value) {
                            case "All":
                                return renderGullList(Gender.All);
                            case "Females":
                                return renderGullList(Gender.Female);
                            case "Males":
                                return renderGullList(Gender.Male);
                        }
                    });

                    // Default rendering, show the whole list of gulls.
                    renderGullList(Gender.All);

                    // Show the legend for the color coding of genders.
                    showGenderLegend();
                    next();
                })
                .queue((next) => {
                    // User interaction for the gender choice within an OD-selection.
                    $('#genders-od').on('change', function () {
                        doSelectOrganims(this.value);
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
                        const val = $('#genders-od').val();
                        doSelectOrganims(val);
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

        /**
         * Deselect current gulls and render the list of gulls for all genders.
         */
        function showDefaultOverview(): void {
            // Deselect all current selections.
            selectGulls([]);
            // Resetting to all gulls and all genders.
            renderGullList(Gender.All);
        }

        function selectGulls(selected: string[]): void {
            console.log(selected);
            gullSelection = selected;

            schematic.refresh();

            if (selected.length < 1) {
                // all is deselected
                $('#global-overview').show();
                $('#selection-overview').hide();
                $(".gender-selection").val("All");
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
                .on('dblclick', function (id: string) {
                    // Return to the gull list by double clicking.
                    showDefaultOverview();
                });
            list.exit().remove();

            d3.select("body").on('keydown', () => {
                const event: any = d3.event;
                // if ESC key is pressed.
                if (event.keyCode === 27) {
                    // release the selection.
                    newSelection = [];
                    // remove the selection class from the list as well.
                    list.classed('selected', false);
                }
            });
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
