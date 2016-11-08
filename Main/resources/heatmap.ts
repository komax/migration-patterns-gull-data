/// <reference path="../libraries/definitions/openlayers.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />
/**
 * A map layer that shows the complete journey of a gull segmented on day/night
 */

interface String {
    hashCode: () => number;
}

(function (global) {

//------------------------------------------------------------------------------

    var defaults = {
        colors: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'],
        style: function (color) {
            return new ol.style.Style({
                fill: new ol.style.Fill({color: color})
            })
        },
        features: function (level) {
            let geojson = new ol.format.GeoJSON();
            return geojson.readFeatures((<any>global).contours["contour" + level]);
        },
        heatmap_local: 'heatmapserver/',
        heatmap_webserver: 'http://localhost:5000/'
    };

    var Heatmap = function Heatmap() {
        this.sources = [];
        this.layers = [];

        for (var i = 0; i < 5; i++) {
            this.sources.push(new ol.source.Vector({}));
            this.sources[i].addFeatures(defaults.features(i + 1));
            this.layers.push(new ol.layer.Vector({
                source: this.sources[i],
                style: defaults.style(defaults.colors[i])
            }));
        }
    };

// from: http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
    String.prototype.hashCode = function () {
        var hash = 0;
        if (this.length === 0) {
            return hash;
        }
        for (let i = 0; i < this.length; i++) {
            let char = this.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash >>> 0; // we want unsigned.. couldn't get the python part to work otherwise..
    };

    Heatmap.prototype.loadHeatmapFrom = function (url, fallback) {
        var self = this;
        $.ajax({
            url: url,
            dataType: 'jsonp',
            crossDomain: true,
            jsonpCallback: 'jsonpContours',
            success: function (data) {
                var contourArray = [data.contour1, data.contour2, data.contour3, data.contour4, data.contour5]

                for (var i = 0; i < self.sources.length; i++) {
                    var geojson = new ol.format.GeoJSON(),
                        features = geojson.readFeatures(contourArray[i]);
                    self.sources[i].clear();
                    self.sources[i].addFeatures(features);
                }

                console.log("Succesfully loaded heatmap.")
            },
            error: function (xhr, status, error) {
                if (fallback) {
                    self.loadHeatmapFrom(fallback);
                } else {
                    console.log(error);
                }
                //console.log("Could not retrieve heatmap.")
            }
        });
    };

    Heatmap.prototype.load = function load(ids) {
        var safe_ids = ids.slice(0);
        var restful_url = defaults.heatmap_webserver + safe_ids.join('$');
        var directory_url = defaults.heatmap_local + safe_ids.sort().join("").hashCode() + '.geojsonp';
        this.loadHeatmapFrom(directory_url, restful_url);
    };

    Heatmap.prototype.setOpacity = function setOpacity(val) {
        for (var i = 0; i < this.layers.length; i++) {
            this.layers[i].setOpacity(val);
        }
    };

    Heatmap.prototype.clear = function clear() {
        for (var i = 0; i < this.layers.length; i++) {
            this.sources[i].clear();
            this.sources[i].addFeatures(defaults.features(i + 1));
        }
    };

//------------------------------------------------------------------------------

    (<any>global).Heatmap = Heatmap;
    (<any>global).Heatmap.main = new Heatmap();

})(window || this);

//------------------------------------------------------------------------------
