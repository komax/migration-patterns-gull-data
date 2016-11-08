/// <reference path="../libraries/definitions/openlayers.d.ts" />
/// <reference path="../libraries/definitions/d3.d.ts" />
/// <reference path="../libraries/definitions/jquery.d.ts" />
/**
 * A map layer that shows the complete journey of a gull segmented on day/night
 */

(function (global) {

//------------------------------------------------------------------------------

    var defaults = {
        day: new ol.style.Style({
            stroke: new ol.style.Stroke({
                //color: [220, 20, 60, .8],
                color: [120, 200, 240, .8],
                width: 3,
            }),
        }),
        night: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: [40, 10, 40, .8],
                width: 3,
            }),
        }),
        twilight: new ol.style.Style({
            stroke: new ol.style.Stroke({
                //color: [90, 180, 220, .8],
                color: [180, 90, 220, .8],
                width: 3,
            }),
        }),
        text: {
            fill: new ol.style.Fill({
                color: 'white',
            }),
            stroke: new ol.style.Stroke({
                color: 'black',
                width: 2,
            }),
        },
        stop: new ol.style.Circle({
            radius: 5,
            fill: new ol.style.Fill({
                color: [180, 220, 90, .8],
            }),
            stroke: new ol.style.Stroke({
                color: 'white',
            }),
        }),
    };

    var dateStamp = d3.time.format('%b %d\n%Y'),
        timeStamp = d3.time.format('%b %d %Y\n%-I:%M %p');

    function labelStyle(feature, resolution) {
        var top = feature.get('features')[0],
            stamp = resolution > 500 ? dateStamp : timeStamp;
        return new ol.style.Style({
            text: new ol.style.Text({
                text: stamp(new Date(top.get('date'))),
                fill: defaults.text.fill,
                stroke: defaults.text.stroke,
            }),
            image: defaults.stop,
        });
    }

    function JSONkey(id) {
        return 'journey_' + id.replace(' ', '_');
    }

    function JSONfile(id) {
        return 'data/' + JSONkey(id) + '.geojsonp';
    }

    function Journey() {
        this.source1 = new ol.source.Vector({});
        this.layer1 = new ol.layer.Vector({
            source: this.source1,
            style: function (feature, resolution) {
                var type = feature.get('type');
                return defaults[type];
            },
        });
        this.source2 = new ol.source.Vector({});
        this.layer2 = new ol.layer.Vector({
            source: new ol.source.Cluster({
                distance: 50,
                source: this.source2,
            }),
            style: labelStyle,
        });
        this.layer = new ol.layer.Group({
            layers: [this.layer1, this.layer2],
        });
    }

    Journey.prototype.load = function load(id) {
        var self = this;
        $.ajax({
            url: JSONfile(id),
            dataType: 'jsonp',
            crossDomain: true,
            jsonpCallback: JSONkey(id),
            success: function (data) {
                var geojson = new ol.format.GeoJSON(),
                    features = geojson.readFeatures(data, {
                        featureProjection: 'EPSG:3857'
                    });
                self.source1.clear();
                self.source2.clear();
                self.source1.addFeatures(features.filter(function (feature) {
                    return feature.get('type') != 'stop';
                }));
                self.source2.addFeatures(features.filter(function (feature) {
                    return feature.get('type') == 'stop';
                }));
            },
        });
    };

    Journey.prototype.clear = function clear() {
        this.source1.clear();
        this.source2.clear();
    };

//------------------------------------------------------------------------------

    (<any>global).Journey = Journey;
    (<any>global).Journey.main = new Journey();

})(window || this);

//------------------------------------------------------------------------------
