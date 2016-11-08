/// <reference path="../libraries/definitions/d3.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />
/// <reference path="../libraries/definitions/jquery.tooltipster.d.ts" />
/**
 * Calendar heatmap for stop frequency
 */

(function (global) {

//------------------------------------------------------------------------------

    function Calendarmap(id, range /*[first year, last year]*/) {
        var self = this;

        this.id = id;
        this.range = d3.range(range[0], range[1] + 1);

        let width = 700,
            height = 105,
            cellSize = 12, // cell size
            week_days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        var day = d3.time.format("%w"),
            week = d3.time.format("%U"),
            percent = d3.format(".1%"),
            format = d3.time.format("%Y%m%d"),
            parseDate = d3.time.format("%Y%m%d").parse;

        var palette = ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f", "#3f007d"];
        var color = this.color = d3.scale.quantize().range(palette)//(["white", '#002b53'])
            .domain([0, 1]);

        var svg = this.svg = d3.select('#' + id).selectAll("svg")
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
            .text(function (d) {
                return d;
            });

        for (var i = 0; i < 7; i++) {
            svg.append("text")
                .attr("transform", "translate(-5," + cellSize * (i + 1) + ")")
                .style("text-anchor", "end")
                .attr("dy", "-.25em")
                .text(function (d) {
                    return week_days[i];
                });
        }

        var rect = this.rect = svg.selectAll(".day")
            .data(function (d) {
                return d3.time.days(new Date(d, 0, 1), new Date(d + 1, 0, 1));
            })
            .enter()
            .append("rect")
            .attr("class", "day")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("x", function (d) {
                return (<any>week(d)) * cellSize;
            })
            .attr("y", function (d) {
                return (<any>day(d)) * cellSize;
            })
            .attr("fill", '#fff')
            .datum(format);

        var legend = svg.selectAll(".legend")
            .data(month)
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", function (d, i) {
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
            var t1 = new Date(t0.getFullYear(), t0.getMonth() + 1, 0),
                d0 = +day(t0), w0 = +week(t0),
                d1 = +day(t1), w1 = +week(t1);
            return "M" + (w0 + 1) * cellSize + "," + d0 * cellSize
                + "H" + w0 * cellSize + "V" + 7 * cellSize
                + "H" + w1 * cellSize + "V" + (d1 + 1) * cellSize
                + "H" + (w1 + 1) * cellSize + "V" + 0
                + "H" + (w0 + 1) * cellSize + "Z";
        }

        rect.on('click', function (d) {
            var gulls = self.stopoverGulls[d] || [];
            (<any>global).Main.intersectGullSelection(gulls);
        });
    }

//------------------------------------------------------------------------------

    Calendarmap.prototype.load = function load(stops, ids) {
        var data = {};
        for (var i = stops.length - 1; i >= 0; --i) {
            var events = stops[i].get('events') || {};
            for (var id in events) {
                if (!(id in data))
                    data[id] = new Range();
                for (var j = events[id].length - 2; j >= 0; j -= 2)
                    data[id].add(events[id][j], events[id][j + 1]);
            }
        }
        for (var id in data)
            data[id] = data[id].toArray();
        visualizeCalendar.call(this, data, ids);
    };

    function formatNames(ids) {
        var div = $('<div>');
        for (var i = 0, l = ids.length; i < l; ++i) {
            div
                .append(!(i % 6) ? ',<br>' : ', ')
                .append($('<span>')
                    .text((<any>global).Main.organisms[ids[i]].name)
                );
        }
        return div;
    }

    function visualizeCalendar(data, gullIDs) {
        function dateToString(date) {
            var formattedString = "";
            formattedString += date.getFullYear();
            var month = date.getMonth() + 1;
            if (month < 10) {
                formattedString += "0";
            }
            formattedString += month;
            var day = date.getDate();
            if (day < 10) {
                formattedString += "0";
            }
            formattedString += day;
            return formattedString;
        }

        // Compute the counts of stops for each day.
        var stopoverDays = this.stopoverDays = {},
            stopoverGulls = this.stopoverGulls = {};
        for (var j = 0, l = gullIDs.length; j < l; ++j) {
            var gullID = gullIDs[j];
            if (data.hasOwnProperty(gullID)) {
                var length = data[gullID].length;
                var i = 0;
                do {
                    var startDate = new Date(data[gullID][i]);
                    var endDate = new Date(data[gullID][i + 1]);

                    while (startDate <= endDate) {
                        // Consider only yearmonthdays and not times anymore.
                        var formattedDate = dateToString(startDate);
                        if (!(stopoverDays.hasOwnProperty(formattedDate))) {
                            stopoverDays[formattedDate] = 0;
                            stopoverGulls[formattedDate] = {};
                        }
                        stopoverDays[formattedDate]++;
                        stopoverGulls[formattedDate][gullID] = true;
                        var newDate = startDate.setDate(startDate.getDate() + 1);
                        startDate = new Date(newDate);
                    }

                    i += 2;
                } while (i < length);
            }
        }
        for (var id in stopoverGulls)
            stopoverGulls[id] = Object.keys(stopoverGulls[id]);

        // Compute the max count in the stop overs.
        var maxValue = Number.MIN_VALUE;

        var counts = $.map(stopoverDays, function (v) {
            return v;
        });
        counts.forEach(function (value) {
            if (value > maxValue) {
                maxValue = value;
            }
        });
        //console.log(maxValue);

        // Visualize the results.
        var color = this.color;
        this.rect//.filter(function(d) { return stopoverDays[d]; })
            .attr("fill", function (d) {
                return color((stopoverDays[d] / maxValue) || 0);
            })
            .each(function (d) {
                var stops = Math.round(stopoverDays[d] || 0);
                $(this).tooltipster('content',
                    formatNames(stopoverGulls[d] || [])
                        .prependText('' + stops + (stops == 1 ? ' stop' : ' stops' ))
                );
            });


    }

//------------------------------------------------------------------------------

    $.fn.prependText = function (text) {
        return this.each(function () {
            $(this).prepend(document.createTextNode(text));
        });
    };

//------------------------------------------------------------------------------

    function Range() {
        this.list = [];
    }

    Range.prototype.add = function add(left, right) {
        if (left > right)
            throw new Error('Range.add failed: ' + left + ' > ' + right);
        this.list.push([left, right]);
        return this;
    };

    Range.prototype.merge = function merge(fudge) {
        fudge = fudge || 0;
        if (this.list.length < 2) return this;
        this.list.sort(function (a, b) {
            return a[0] - b[0];
        });
        var list = [],
            range = this.list.pop(),
            head = undefined;
        while (this.list.length > 0) {
            head = this.list.pop();
            if (range[0] > head[1] + 1 + fudge)
                list.unshift(range);
            else if (range[1] > head[1])
                head[1] = range[1];
            range = head;
        }
        list.unshift(range);
        this.list = list;
        return this;
    };

    Range.prototype.toArray = function toArray() {
        var arr = [];
        for (var i = 0, l = this.list.length; i < l; ++i) {
            arr.push(this.list[i][0]);
            arr.push(this.list[i][1]);
        }
        return arr;
    };

//------------------------------------------------------------------------------

    (<any>global).Calendarmap = Calendarmap;

})(window || this);

//------------------------------------------------------------------------------
