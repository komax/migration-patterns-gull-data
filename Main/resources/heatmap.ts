/// <reference path="../libraries/definitions/openlayers.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />
/**
 * A map layer that shows the complete journey of a gull segmented on day/night
 */

declare let contours: any;

namespace MigrationVisualization {

    const defaults = {
        colors: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'],
        style: function (color) {
            return new ol.style.Style({
                fill: new ol.style.Fill({color: color})
            })
        },
        features: function (level) {
            let geojson = new ol.format.GeoJSON();
            let contours_zoom_level = contours["contour" + level];
            return geojson.readFeatures(contours_zoom_level);
        },
        heatmap_local: 'heatmapserver/',
        heatmap_webserver: 'http://localhost:5000/'
    };

    export function heatmapLegend(): string {
        let heatmapLegendHTMLcode: string = "";

        function computeLegend(): string {
            const palette = defaults.colors.slice();
            // Pad with invisible rects on the left and the right.
            palette.unshift('rgba(0,0,0,0)');
            palette.push('rgba(0,0,0,0)');

            const data: any[] = [];
            let offset = 0;
            const rectWidth = 20;

            for (let i = 0; i < palette.length; i++) {
                data.push({x: offset, w: rectWidth});
                offset += rectWidth;
            }


            const height = 30, width = 280;
            const margin = {top: 2, right: 2, bottom: 2, left: 2},
                innerWidth = width - margin.left - margin.right,
                innerHeight = height - margin.top - margin.bottom;

            // Create the svg element.
            const svg = d3.select("#heatmap-legend").append("svg")
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
                        return "Less";
                    } else if (i === palette.length - 1) {
                        return "More";
                    } else {
                        return "";
                    }
                })
                .attr("x", (d) => {
                    return x(d.w / 2 + d.x);
                })
                .attr("y", margin.top + innerHeight / 2)
                .attr("font-size", 15)
                .attr('font-family','sans-serif')
                .style("text-anchor", "middle")
                .style("alignment-baseline", "middle")
                .style("fill", "#000000")
                // .style("stroke", "#000000")
                // .style("stroke-width", 1)
                .style("font-weight", "bold");

            // Generate the html code for the legend.
            const htmlCode: string = $("#heatmap-legend").html();

            // Remove the temporary svg element.
            d3.select(`#heatmap-legend svg`).remove();
            return htmlCode;
        }

        $(document).ready(() => {
            heatmapLegendHTMLcode = computeLegend();
        });
        if (heatmapLegendHTMLcode === "") {
            heatmapLegendHTMLcode = computeLegend();
        }
        return heatmapLegendHTMLcode;
    }

    export class Heatmap {
        private sources: Array<ol.source.Vector>;
        readonly layers: Array<ol.layer.Vector>;

        constructor() {
            this.sources = [];
            this.layers = [];

            for (let i = 0; i < 5; i++) {
                this.sources.push(new ol.source.Vector({}));
                this.sources[i].addFeatures(defaults.features(i + 1));
                this.layers.push(new ol.layer.Vector({
                    source: this.sources[i],
                    style: defaults.style(defaults.colors[i])
                }));
            }
        }

        loadHeatmapFrom(url: string, fallback: string) {
            $.ajax({
                url: url,
                dataType: 'jsonp',
                crossDomain: true,
                jsonpCallback: 'jsonpContours',
                success: (data) => {
                    let contourArray = [data.contour1, data.contour2, data.contour3, data.contour4, data.contour5];

                    for (let i = 0; i < this.sources.length; i++) {
                        let geojson = new ol.format.GeoJSON(),
                            features = geojson.readFeatures(contourArray[i]);
                        this.sources[i].clear();
                        this.sources[i].addFeatures(features);
                    }

                    console.log("Succesfully loaded heatmap.");
                },
                error: (xhr, status, error) => {
                    if (fallback) {
                        this.loadHeatmapFrom(fallback, fallback);
                    } else {
                        console.log(error);
                    }
                    console.log("Could not retrieve heatmap.");

                }
            });
        }

        load(ids) {
            let safe_ids = ids.slice(0);
            let restful_url: string = defaults.heatmap_webserver + safe_ids.join('$');
            let directory_url: string = defaults.heatmap_local + hashCode(safe_ids.sort().join("")) + '.geojsonp';
            this.loadHeatmapFrom(directory_url, restful_url);
        }

        setOpacity(val) {
            for (let layer of this.layers) {
                layer.setOpacity(val);
            }
        }

        clear() {
            for (let i = 0; i < this.layers.length; i++) {
                this.sources[i].clear();
                this.sources[i].addFeatures(defaults.features(i + 1));
            }
        }
    }

// from: http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
    function hashCode(strInput: string): number {
        let hash = 0;
        if (strInput.length === 0) {
            return hash;
        }
        for (let i = 0; i < strInput.length; i++) {
            let char = strInput.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash >>> 0; // we want unsigned.. couldn't get the python part to work otherwise..
    }

    export const heatmap = new Heatmap();

}
