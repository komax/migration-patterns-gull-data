/// <reference path="../libraries/definitions/d3.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />
/// <reference path="../libraries/definitions/jquery.tooltipster.d.ts" />
/**
 * Calendar heatmap for stop frequency
 */

interface JQuery {
    prependText(text: String): JQuery;
}

namespace MigrationVisualization {

    export class CalendarMap {
        private static width = 700;
        private static height = 105;
        private static cellSize = 12; // cell size
        private static week_days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        private static month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        private static day = d3.time.format("%w");
        private static week = d3.time.format("%U");
        private static percent = d3.format(".1%");
        private static format = d3.time.format("%Y%m%d");

        private id: string;
        private yearsRange: Array<number>;
        private color;
        private svg;
        private rect;
        private stopoverGulls;
        private palette: string[];
        private selectionContours;
        private organismsIDs: string[];

        private stops: ol.Feature[];
        private showOnlySelectedStopovers: boolean;

        constructor(id: string, range: [number, number]) {
            this.organismsIDs = [];
            this.id = id;
            this.yearsRange = d3.range(range[0], range[1] + 1);

            // Same palette as for coloring the nodes.
            this.palette = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'];
            this.color = d3.scale.quantize().range(this.palette)//(["white", '#002b53'])
                .domain([0, 1]);

            this.svg = d3.select('#' + id).selectAll("svg")
                .data(this.yearsRange)
                .enter().append("svg")
                .attr("width", CalendarMap.width)
                .attr("data-height", '0.5678')
                .attr("viewBox", '0 0 ' + CalendarMap.width + ' ' + CalendarMap.height)
                .attr("shape-rendering", "crispEdges")
                .attr("class", "RdYlGn")
                // year as id;
                .attr("id", function (d) {
                    return `year${d}`;
                })
                .append("g")
                .attr("transform", "translate(" + ((CalendarMap.width - CalendarMap.cellSize * 53) / 2) + "," + (CalendarMap.height - CalendarMap.cellSize * 7 - 1) + ")");

            this.svg.append("text")
                .attr("transform", "translate(-38," + CalendarMap.cellSize * 3.5 + ")rotate(-90)")
                .style("text-anchor", "middle")
                .text((d) => {
                    return d;
                });

            for (let i = 0; i < 7; i++) {
                this.svg.append("text")
                    .attr("transform", "translate(-5," + CalendarMap.cellSize * (i + 1) + ")")
                    .style("text-anchor", "end")
                    .attr("dy", "-.25em")
                    .text((d) => {
                        return CalendarMap.week_days[i];
                    });
            }

            this.rect = this.svg.selectAll(".day")
                .data((d) => {
                    return d3.time.days(new Date(d, 0, 1), new Date(d + 1, 0, 1));
                })
                .enter()
                .append("rect")
                .attr("class", "day")
                .attr("width", CalendarMap.cellSize)
                .attr("height", CalendarMap.cellSize)
                .attr("x", (d) => {
                    return (<any>CalendarMap.week(d)) * CalendarMap.cellSize;
                })
                .attr("y", (d) => {
                    return (<any>CalendarMap.day(d)) * CalendarMap.cellSize;
                })
                .attr("fill", '#fff')
                .datum(CalendarMap.format);

            const legend = this.svg.selectAll(".legend")
                .data(CalendarMap.month)
                .enter().append("g")
                .attr("class", "legend")
                .attr("transform", (d, i) => {
                    return "translate(" + (((i + 1) * 50) + 8) + ",0)";
                });

            legend.append("text")
                .attr("class", function (d, i) {
                    return CalendarMap.month[i]
                })
                .style("text-anchor", "end")
                .attr("dy", "-.25em")
                .text(function (d, i) {
                    return CalendarMap.month[i]
                });

            this.svg.selectAll(".month")
                .data(function (d) {
                    return d3.time.months(new Date(d, 0, 1), new Date(d + 1, 0, 1));
                })
                .enter().append("path")
                .attr("class", "month")
                .attr("id", function (d, i) {
                    return CalendarMap.month[i]
                })
                .attr("d", monthPath);

            $('#' + this.id + ' rect').tooltipster({contentAsHTML: true});

            function monthPath(t0) {
                const t1 = new Date(t0.getFullYear(), t0.getMonth() + 1, 0),
                    d0 = +CalendarMap.day(t0), w0 = +CalendarMap.week(t0),
                    d1 = +CalendarMap.day(t1), w1 = +CalendarMap.week(t1);
                return "M" + (w0 + 1) * CalendarMap.cellSize + "," + d0 * CalendarMap.cellSize
                    + "H" + w0 * CalendarMap.cellSize + "V" + 7 * CalendarMap.cellSize
                    + "H" + w1 * CalendarMap.cellSize + "V" + (d1 + 1) * CalendarMap.cellSize
                    + "H" + (w1 + 1) * CalendarMap.cellSize + "V" + 0
                    + "H" + (w0 + 1) * CalendarMap.cellSize + "Z";
            }

            // Add the elements for the selected-time-range for each year.
            this.svg.each(function (d, i) {
                d3.select(this).selectAll(".selected-time-range")
                    .data([d])
                    .enter().append("path")
                    .attr("class", "selected-time-range")
                    .attr("d", "");
            });

            this.selectionContours = this.svg.selectAll(".selected-time-range");

            const self = this;
            // Objects to maintain a time range as a selection.
            let newDuration: DurationRange | undefined = undefined;
            let rangeAsElem: [Element, Element] | undefined;

            // Handle a single click action and/or selecting a range by clicking and using shift.
            this.rect.on('click', function (d: string) {
                const selectedDate = CalendarMap.format.parse(d);
                const event: MouseEvent = <MouseEvent>d3.event;
                if (event.shiftKey) {
                    const svgElement = d3.select(this);
                    // Check whether the current element has been selected.
                    if (svgElement.classed('selected')) {
                        // Deselect it then
                        svgElement.classed('selected', false);
                        if (newDuration !== undefined && rangeAsElem !== undefined) {
                            const [startTimeRange, endTimeRange] = newDuration;
                            // Reduce the time range to one of them
                            if (startTimeRange.getTime() === selectedDate.getTime()) {
                                newDuration = [endTimeRange, endTimeRange];
                                rangeAsElem[0] = rangeAsElem[1];
                            } else if (endTimeRange.getTime() === selectedDate.getTime()) {
                                newDuration = [startTimeRange, startTimeRange];
                                rangeAsElem[1] = rangeAsElem[0];
                            } else {
                                // or delete the elements.
                                newDuration = rangeAsElem = undefined;
                            }
                        }
                    } else {
                        // Select it otherwise.
                        svgElement.classed('selected', true);
                        if (newDuration !== undefined && rangeAsElem !== undefined) {
                            const [startTimeRange, endTimeRange] = newDuration;
                            // time range is just a single date.
                            if (startTimeRange === endTimeRange) {
                                if (hasEndedBefore(startTimeRange, selectedDate)) {
                                    newDuration = [startTimeRange, selectedDate];
                                    rangeAsElem[1] = this;
                                } else {
                                    newDuration = [selectedDate, endTimeRange];
                                    rangeAsElem[0] = this;
                                }
                            } else {
                                // Extension to one side: start or to the end.
                                if (hasEndedBefore(endTimeRange, selectedDate)) {
                                    const endElement = d3.select(rangeAsElem[1]);
                                    // Deselect the old end of the time range.
                                    endElement.classed('selected', false);
                                    rangeAsElem[1] = this;
                                    newDuration = [startTimeRange, selectedDate];
                                } else if (hasEndedBefore(selectedDate, startTimeRange)) {
                                    const startElement = d3.select(rangeAsElem[0]);
                                    // Deselect the old end of the time range.
                                    startElement.classed('selected', false);
                                    rangeAsElem[0] = this;
                                    newDuration = [selectedDate, endTimeRange];
                                } else {
                                    // selected date lies within the range.
                                    // Decide on which end it will be.
                                    if (diffDateInHours(startTimeRange, selectedDate) <
                                        diffDateInHours(selectedDate, endTimeRange)) {
                                        const startElement = d3.select(rangeAsElem[0]);
                                        // Deselect the old end of the time range.
                                        startElement.classed('selected', false);
                                        rangeAsElem[0] = this;
                                        newDuration = [selectedDate, endTimeRange];
                                    } else {
                                        const endElement = d3.select(rangeAsElem[1]);
                                        // Deselect the old end of the time range.
                                        endElement.classed('selected', false);
                                        rangeAsElem[1] = this;
                                        newDuration = [startTimeRange, selectedDate];
                                    }
                                }
                            }
                        } else {
                            // Create a new selection.
                            newDuration = [selectedDate, selectedDate];
                            rangeAsElem = [this, this];
                        }
                    }
                }
                if (newDuration !== undefined) {
                    let [startDate, endDate] = newDuration;
                    if (startDate.getTime() !== endDate.getTime()) {
                        // Update the selected range.
                        self.selectionContours
                            .attr("d", (year) => {
                                return CalendarMap.selectionPath(year, startDate, endDate);
                            });

                        Main.selectOrganismsWithinDuration(newDuration);
                    }
                }
                // else {
                //     // Select a day
                //     const gulls = self.stopoverGulls[d] || [];
                //     Main.selectGulls(gulls);
                // }
            });

            // Press delete to remove the current selection.
            const eventHandler = (e) => {
                // if delete key is pressed.
                if (e.which === 46) {
                    // release the selection.
                    newDuration = undefined;
                    this.disposeCurrentSelection();
                }
            };

            document.addEventListener("keydown", eventHandler.bind(this));

            this.showOnlySelectedStopovers = false;

            this.stops = [];

            // Press delete to remove the current selection.
            const handleSpace = (e) => {
                // if space key is pressed.
                if (e.which === 32) {
                    // Toggle the last parameter.
                    this.showOnlySelectedStopovers = !this.showOnlySelectedStopovers;
                    // reload the calendar on the same selection.
                    this.load(this.stops, this.organismsIDs);
                }
            };

            document.addEventListener("keydown", handleSpace.bind(this));

            this.paintLegend();
        }

        private disposeCurrentSelection(): void {
            // Clearing the contours
            this.selectionContours
                .attr("d", "");
            // Clearing the days.
            this.rect.classed("selected", false);
            // Clearing the selection.
        }

        private static selectionPath(year: number, startDate: Date, endDate: Date): string {
            const startYear: number = startDate.getFullYear();
            const endYear: number = endDate.getFullYear();
            if (year < startYear || endYear < year) {
                // Show no path if the year is not in the selection.
                return "";
            }
            let fromDay: number, fromWeek: number,
                toDay: number, toWeek: number;
            if (year === startYear && year === endYear) {
                // Case start and end are within the same year.
                fromDay = +CalendarMap.day(startDate), fromWeek = +CalendarMap.week(startDate),
                    toDay = +CalendarMap.day(endDate), toWeek = +CalendarMap.week(endDate);
            } else if (year === startYear && year < endYear) {
                // Case start until the end of the year.
                const endDay = new Date(year, 11, 31);
                fromDay = +CalendarMap.day(startDate), fromWeek = +CalendarMap.week(startDate),
                    toDay = +CalendarMap.day(endDay), toWeek = +CalendarMap.week(endDay);
            } else if (startYear < year && year < endYear) {
                // Cover the whole year. start and end lie somewhere outside.
                const startDay = new Date(year, 0, 1);
                const endDay = new Date(year, 11, 31);
                fromDay = +CalendarMap.day(startDay), fromWeek = +CalendarMap.week(startDay),
                    toDay = +CalendarMap.day(endDay), toWeek = +CalendarMap.week(endDay);
            } else if (startYear < year && year === endYear) {
                // Case cover the beginning of the year until the end date.
                const startDay = new Date(year, 0, 1);
                fromDay = +CalendarMap.day(startDay), fromWeek = +CalendarMap.week(startDay),
                    toDay = +CalendarMap.day(endDate), toWeek = +CalendarMap.week(endDate);
            } else {
                return "";
            }
            return "M" + (fromWeek + 1) * CalendarMap.cellSize + "," + fromDay * CalendarMap.cellSize
                + "H" + fromWeek * CalendarMap.cellSize + "V" + 7 * CalendarMap.cellSize
                + "H" + toWeek * CalendarMap.cellSize + "V" + (toDay + 1) * CalendarMap.cellSize
                + "H" + (toWeek + 1) * CalendarMap.cellSize + "V" + 0
                + "H" + (fromWeek + 1) * CalendarMap.cellSize + "Z";
        }

        /**
         * Draw the legend of the color coding for the calendar view.
         *
         */
        private paintLegend() {
            const data: any[] = [];
            let offset = 0;
            const rectWidth = 50;

            const extendedPalette = this.palette.slice();
            extendedPalette.unshift('rgba(0,0,0,0)');
            extendedPalette.push('rgba(0,0,0,0)');

            for (let i = 0; i < extendedPalette.length; i++) {
                data.push({x: offset, w: rectWidth});
                offset += rectWidth;
            }


            const height = 50, width = 370;
            const margin = {top: 10, right: 2, bottom: 2, left: 20},
                innerWidth = width - margin.left - margin.right,
                innerHeight = height - margin.top - margin.bottom;

            // Create the svg element.
            const svg = d3.select("#calendar-legend").append("svg")
                .attr("width", innerWidth + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${margin.left}, ${margin.top})`);


            // Set up the scale to correspond to the rectWidths.
            const x = d3.scale.linear()
                .rangeRound([0, innerWidth])
                .domain([0, extendedPalette.length * rectWidth - 1]);

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
                    return extendedPalette[i];
                });

            // Add text labels to the columns.
            svg.selectAll("text")
                .data(data)
                .enter()
                .append("text")
                .text((d, i) => {
                    if (i === 0) {
                        return "Less";
                    } else if (i === extendedPalette.length - 1) {
                        return "More";
                    } else {
                        return "";
                    }
                })
                .attr("x", (d, i) => {
                    if (i === extendedPalette.length - 1 ) {
                        return x(d.w / 2 + d.x + 2 * margin.right);
                    }
                    return x(d.w / 2 + d.x - 2 * margin.right);
                    // if (i === 0) {
                    //     return x(d.w + d.x);
                    // } else {
                    //     return x(d.x);
                    // }

                })
                .attr("y", margin.top + innerHeight / 2)
                .attr("font-size", 13)
                .attr('font-family', 'sans-serif')
                .style("text-anchor", "middle")
                .style("alignment-baseline", "middle")
                .style("fill", "#000000")
                // .style("stroke", "#000000")
                // .style("stroke-width", 1)
                .style("font-weight", "bold");

        }

        /**
         * Is setA a subset of setB or setB of setA
         * @param setA
         * @param setB
         * @returns {boolean}
         */
        private static isSubsetOf(setA: string[], setB: string[]): boolean {
            return setB.every((elem, i) => {
                    return setA.indexOf(elem) >= 0;
                }) || setA.every((elem, i) => {
                    return setB.indexOf(elem) >= 0;
                });
        }

        load(stops: ol.Feature[], ids: string[]) {
            // If the current ids are empty or we deal NOT with a subset of previous ids, dispose the visualization of
            // the current selection.
            if (ids.length === 0 || !CalendarMap.isSubsetOf(this.organismsIDs, ids)) {
                this.disposeCurrentSelection();
            }

            // Store the ids for the future calls.
            this.stops = stops;
            this.organismsIDs = ids;
            const data = {};
            for (let i = stops.length - 1; i >= 0; --i) {
                const events: Stopover = stops[i].get('events') || {};
                if (this.showOnlySelectedStopovers && stops[i].get('selectionNumber') === undefined) {
                    // Skip if showing only selected stopovers the ones without a selectionNumber.
                    continue;
                }
                for (let id in events) {
                    if (!(id in data)) {
                        data[id] = new Range();
                    }
                    for (let j = events[id].length - 2; j >= 0; j -= 2) {
                        const [start, end] = [events[id][j], events[id][j + 1]];
                        data[id].add(start, end);
                    }
                }
            }
            for (let id in data) {
                data[id] = data[id].toArray();
            }


            this.visualizeCalendar(data, ids);
        }

        private visualizeCalendar(data, gullIDs) {
            function dateToString(date) {
                let formattedString = "";
                formattedString += date.getFullYear();
                let month = date.getMonth() + 1;
                if (month < 10) {
                    formattedString += "0";
                }
                formattedString += month;
                let day = date.getDate();
                if (day < 10) {
                    formattedString += "0";
                }
                formattedString += day;
                return formattedString;
            }

            // Compute the counts of stops for each day.
            let stopoverDays = {},
                stopoverGulls = this.stopoverGulls = {};
            for (let j = 0, l = gullIDs.length; j < l; ++j) {
                let gullID = gullIDs[j];
                if (data.hasOwnProperty(gullID)) {
                    let length = data[gullID].length;
                    let i = 0;
                    do {
                        let startDate: Date = new Date(data[gullID][i]);
                        let endDate: Date = new Date(data[gullID][i + 1]);

                        while (startDate <= endDate) {
                            // Consider only yearmonthdays and not times anymore.
                            let formattedDate = dateToString(startDate);
                            if (!(stopoverDays.hasOwnProperty(formattedDate))) {
                                stopoverDays[formattedDate] = 0;
                                stopoverGulls[formattedDate] = {};
                            }
                            stopoverDays[formattedDate]++;
                            stopoverGulls[formattedDate][gullID] = true;
                            const newDate = startDate.setDate(startDate.getDate() + 1);
                            startDate = new Date(newDate);
                        }

                        i += 2;
                    } while (i < length);
                }
            }
            for (let id in stopoverGulls) {
                stopoverGulls[id] = Object.keys(stopoverGulls[id]);
            }

            // Compute the max count in the stop overs.
            let maxValue = Number.MIN_VALUE;

            let counts = $.map(stopoverDays, function (v) {
                return v;
            });
            counts.forEach(function (value) {
                if (value > maxValue) {
                    maxValue = value;
                }
            });
            //console.log(maxValue);

            // Visualize the results.
            this.rect//.filter(function(d) { return stopoverDays[d]; })
                .attr("fill", (d) => {
                    return this.color((stopoverDays[d] / maxValue) || 0);
                })
                .each(function (d) {
                    const stops = Math.round(stopoverDays[d] || 0);
                    const content: string = formatNames(stopoverGulls[d] || [])
                        .prependText('' + stops + (stops == 1 ? ' stop' : ' stops'))
                        .html();
                    $(this).tooltipster('content', content);
                });


        }
    }

//------------------------------------------------------------------------------

    function formatNames(ids): JQuery {
        let div = $('<div>');
        for (let i = 0, l = ids.length; i < l; ++i) {
            div
                .append(!(i % 6) ? ',<br>' : ', ')
                .append($('<span>')
                    .text(Main.organisms[ids[i]].name)
                );
        }
        return div;
    }


//------------------------------------------------------------------------------

    $.fn.prependText = function (text: string): JQuery {
        return this.each(function () {
            $(this).prepend(document.createTextNode(text));
        });
    };

//------------------------------------------------------------------------------

    class Range {
        private list: Array<Array<number>>;

        constructor() {
            this.list = [];
        }

        add(left: number, right: number) {
            if (left > right)
                throw new Error('Range.add failed: ' + left + ' > ' + right);
            this.list.push([left, right]);
            return this;
        };

        // merge(fudge) {
        //     fudge = fudge || 0;
        //     if (this.list.length < 2) {
        //         return this;
        //     } else {
        //         this.list.sort(function (a, b) {
        //             return a[0] - b[0];
        //         });
        //         let list = [],
        //             range = this.list.pop(),
        //             head = this.list.pop();
        //         while (this.list.length > 0) {
        //             if (range[0] > head[1] + 1 + fudge) {
        //                 list.unshift(range);
        //             } else if (range[1] > head[1]) {
        //                 head[1] = range[1];
        //             }
        //             range = head;
        //             head = this.list.pop();
        //         }
        //         list.unshift(range);
        //         this.list = list;
        //         return this;
        //     }
        // }

        toArray() {
            let arr: number[] = [];
            for (let i = 0, l = this.list.length; i < l; ++i) {
                let [left, right] = this.list[i];
                arr.push(left);
                arr.push(right);
            }
            return arr;
        }
    }
}
