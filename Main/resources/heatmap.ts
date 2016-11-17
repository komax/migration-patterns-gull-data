/// <reference path="../libraries/definitions/openlayers.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />
/**
 * A map layer that shows the complete journey of a gull segmented on day/night
 */

declare let contours: any;

namespace MigrationVisualization {

    console.log("Running heatmap file!");

    let defaults = {
        colors: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'],
        style: function (color) {
            return new ol.style.Style({
                fill: new ol.style.Fill({color: color})
            })
        },
        features: function (level) {
            let geojson = new ol.format.GeoJSON();
            return geojson.readFeatures(contours["contour" + level]);
        },
        heatmap_local: 'heatmapserver/',
        heatmap_webserver: 'http://localhost:5000/'
    };

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
        };

        loadHeatmapFrom(url, fallback) {
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

                    console.log("Succesfully loaded heatmap.")
                },
                error: (xhr, status, error) => {
                    if (fallback) {
                        this.loadHeatmapFrom(fallback);
                    } else {
                        console.log(error);
                    }
                    //console.log("Could not retrieve heatmap.")
                }
            });
        }

        load(ids) {
            let safe_ids = ids.slice(0);
            let restful_url = defaults.heatmap_webserver + safe_ids.join('$');
            let directory_url = defaults.heatmap_local + hashCode(safe_ids.sort().join("")) + '.geojsonp';
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
        if (this.length === 0) {
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