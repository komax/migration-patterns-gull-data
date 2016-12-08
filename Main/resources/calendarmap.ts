/// <reference path="../libraries/definitions/d3.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />
/// <reference path="../libraries/definitions/jquery.tooltipster.d.ts" />
/**
 * Calendar heatmap for stop frequency
 */

 interface JQuery {
     prependText(text: String): JQuery;
 }


 interface Stopovers {
     [id: string]: Array<number>;
 }

namespace MigrationVisualization {

    export class CalendarMap {
        private id: string;
        private range: Array<number>;
        private color;
        private svg;
        private rect;
        private stopoverGulls;

        constructor(id: string, range: Array<number>) {
            this.id = id;
            this.range = d3.range(range[0], range[1] + 1);

            let width = 700,
                height = 105,
                cellSize = 12, // cell size
                week_days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            let day = d3.time.format("%w"),
                week = d3.time.format("%U"),
                percent = d3.format(".1%"),
                format = d3.time.format("%Y%m%d"),
                parseDate = d3.time.format("%Y%m%d").parse;

            let palette = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'];
            let color = this.color = d3.scale.quantize().range(palette)//(["white", '#002b53'])
                .domain([0, 1]);

            let svg = this.svg = d3.select('#' + id).selectAll("svg")
                .data(this.range)
                .enter().append("svg")
                .attr("width", width)
                .attr("data-height", '0.5678')
                .attr("viewBox", '0 0 ' + width + ' ' + height)
                .attr("shape-rendering", "crispEdges")
                .attr("class", "RdYlGn")
                .append("g")
                .attr("transform", "translate(" + ((width - cellSize * 53) / 2) + "," + (height - cellSize * 7 - 1) + ")");

            svg.append("text")
                .attr("transform", "translate(-38," + cellSize * 3.5 + ")rotate(-90)")
                .style("text-anchor", "middle")
                .text((d) => {
                    return d;
                });

            for (let i = 0; i < 7; i++) {
                svg.append("text")
                    .attr("transform", "translate(-5," + cellSize * (i + 1) + ")")
                    .style("text-anchor", "end")
                    .attr("dy", "-.25em")
                    .text((d) => {
                        return week_days[i];
                    });
            }

            let rect = this.rect = svg.selectAll(".day")
                .data((d) => {
                    return d3.time.days(new Date(d, 0, 1), new Date(d + 1, 0, 1));
                })
                .enter()
                .append("rect")
                .attr("class", "day")
                .attr("width", cellSize)
                .attr("height", cellSize)
                .attr("x", (d) => {
                    return (<any>week(d)) * cellSize;
                })
                .attr("y", (d) => {
                    return (<any>day(d)) * cellSize;
                })
                .attr("fill", '#fff')
                .datum(format);

            let legend = svg.selectAll(".legend")
                .data(month)
                .enter().append("g")
                .attr("class", "legend")
                .attr("transform", (d, i) => {
                    return "translate(" + (((i + 1) * 50) + 8) + ",0)";
                });

            legend.append("text")
                .attr("class", function (d, i) {
                    return month[i]
                })
                .style("text-anchor", "end")
                .attr("dy", "-.25em")
                .text(function (d, i) {
                    return month[i]
                });

            svg.selectAll(".month")
                .data(function (d) {
                    return d3.time.months(new Date(d, 0, 1), new Date(d + 1, 0, 1));
                })
                .enter().append("path")
                .attr("class", "month")
                .attr("id", function (d, i) {
                    return month[i]
                })
                .attr("d", monthPath);

            $('#' + this.id + ' rect').tooltipster();

            function monthPath(t0) {
                let t1 = new Date(t0.getFullYear(), t0.getMonth() + 1, 0),
                    d0 = +day(t0), w0 = +week(t0),
                    d1 = +day(t1), w1 = +week(t1);
                return "M" + (w0 + 1) * cellSize + "," + d0 * cellSize
                    + "H" + w0 * cellSize + "V" + 7 * cellSize
                    + "H" + w1 * cellSize + "V" + (d1 + 1) * cellSize
                    + "H" + (w1 + 1) * cellSize + "V" + 0
                    + "H" + (w0 + 1) * cellSize + "Z";
            }

            rect.on('click', (d) => {
                let gulls = this.stopoverGulls[d] || [];
                Main.intersectGullSelection(gulls);
            });
        }

        load(stops: ol.Feature[], ids: string[]) {
            // console.log("CalendarMap.load");
            // console.log(stops);
            // console.log(ids);
            let data = {};
            for (let i = stops.length - 1; i >= 0; --i) {
                let events: Stopovers = stops[i].get('events') || {};
                for (let id in events) {
                    if (!(id in data)) {
                        data[id] = new Range();
                    }
                    for (let j = events[id].length - 2; j >= 0; j -= 2) {
                        let [start, end] = [events[id][j], events[id][j+1]];
                        data[id].add(start, end);
                    }
                }
            }
            for (let id in data) {
                data[id] = data[id].toArray();
            }
            // console.log(data);
            visualizeCalendar.call(this, data, ids);
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

    function visualizeCalendar(data, gullIDs) {
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
        let stopoverDays = this.stopoverDays = {},
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
                        let newDate = startDate.setDate(startDate.getDate() + 1);
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
        let color = this.color;
        this.rect//.filter(function(d) { return stopoverDays[d]; })
            .attr("fill", function (d) {
                return color((stopoverDays[d] / maxValue) || 0);
            })
            .each(function (d) {
                let stops = Math.round(stopoverDays[d] || 0);
                let content: string = formatNames(stopoverGulls[d] || [])
                        .prependText('' + stops + (stops == 1 ? ' stop' : ' stops'))
                        .html();
                $(this).tooltipster('content', content);
            });


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
